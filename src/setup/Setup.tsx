import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardGroup, Col, Container, Form, Modal, Row } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet";

import LoadingText from "./LoadingText";
import Email from './Email';
import EmailGroup from './EmailGroup';
import EmailInfo from "./EmailInfo";

function Setup(props: {}) {

  type MinimalMessage = {
    id: string,
    threadId: string
  };


  const [step, setStep] = useState<number>(1);
  const [filterMethod, setFilterMethod] = useState<'read' | 'archive' | 'trash' | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [extraMessage, setExtraMessage] = useState<string>('');
  const [whitelistedEmailGroups, setWhitelistedEmailGroups] = useState<EmailGroup[]>([]);
  const [blockedEmailGroups, setBlockedEmailGroups] = useState<EmailGroup[]>([]);
  const [blockedEmailGroupsSearch, setBlockedEmailGroupsSearch] = useState<string>('');
  const [showFilterConfirmation, setShowFilterConfirmation] = useState<boolean>(false);
  const [numMessagesModified, setNumMessagesModified] = useState<number>(0);

  const navigate = useNavigate();
  

  // initiate gapi
  useEffect(() => {
    gapi.load('client:auth2', () => {
      gapi.client.init({
        apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
        clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
        scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic'
      })
        .then(() => {
          // check if all perms, is signed in, etc. Otherwise, redirect to signin screen
          const googleAuth = gapi.auth2.getAuthInstance();
          const googleUser = googleAuth.currentUser.get();
          const hasPerms = googleUser.hasGrantedScopes('https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic');
          if(!googleAuth.isSignedIn.get() || !hasPerms) {
            navigate('/signin');
            return; // stop execution of useEffect on now unmounted component
          }

          // check if account was already modified by CSG. If so, redirect to manage.
          gapi.client.gmail.users.labels.list({
            userId: 'me'
          })
            .then(({ result: { labels: labels } }) => {
              if(labels?.map(label => label!.name!.startsWith('Modified by College Spam Guard')).includes(true) && step === 1) {
                navigate('/manage');
                return; // stop execution of useEffect on now unmounted component
              }
            });
        });
    });
  }, []);


  // load and process emails on step 2
  useEffect(() => {
    if(step === 2 && !isLoading) {
      setIsLoading(true);

      // get list of colleges with urls and names from CSG server
      axios.get(new URL('college-urls', process.env.REACT_APP_API_URL).href)
        .then(({ data: collegeURLs }) => {
          type CollegeURL = {
            url: string,
            isEdu: boolean,
            name: string
          };

          // creates search term for all edu domains, plus any non-edu's from our college list
          const collegeURLSearchTerm = `from:{*@*.edu ${collegeURLs.filter((d: CollegeURL) => !d.isEdu).map((d: CollegeURL) => `*@${d.url}`).join(' ')}}`;

          // search for likely spammers
          gapi.client.gmail.users.messages.list({
            userId: 'me',
            maxResults: 500,
            includeSpamTrash: true,
            q: 'after: 1970/01/01'
              + '(unsubscribe OR subscribe OR subscription OR (update AROUND 5 preferences) OR (change AROUND 5 preferences) OR (email AROUND 5 preferences) OR (update AROUND 5 email))'
              + `(from:{college university admission admissions school} OR ${collegeURLSearchTerm})` // or exceptions from server check list
          })
            .then(async ({ result: { messages: minimalMessages } }) => {

              // batch search result message id's into 50s to get message details
              let messageCount = 0;
              const messageBatches = [];
              const numMessagesAtEachBatch = [];
              for(const messageID of minimalMessages?.map(d => d.id!)!) {
                if(messageCount % 50 === 0) {
                  numMessagesAtEachBatch.push(messageCount);
                  messageBatches.push(gapi.client.newBatch());
                }

                messageBatches[messageBatches.length-1].add(gapi.client.gmail.users.messages.get({
                  userId: 'me',
                  id: messageID,
                  format: 'metadata',
                  metadataHeaders: ['From', 'Subject']
                }), { id: messageID, callback: () => {} });

                ++messageCount;
              }

              // run message batches one by one to prevent rate limit
              const messageBatchResults = [];
              let messageBatchIndex = 0;
              for(const messageBatch of messageBatches) {
                setExtraMessage(`Loading emails (${numMessagesAtEachBatch[messageBatchIndex]}/${messageCount})`);
                messageBatchResults.push(await messageBatch); // run batch
                if(messageBatchIndex !== messageBatches.length-1) await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 second for rate limiting
                ++messageBatchIndex;
              }
              setExtraMessage(''); // clears extra message

              // consolidate into single array of full messages
              const messageResults: gapi.client.gmail.Message[] = [];
              for(const messageBatch of messageBatchResults) {
                for(const result of Object.values(messageBatch.result)) {
                  messageResults.push(result.result as gapi.client.gmail.Message);
                }
              }

              // helper function that converts email address into full Email object
              const convertEmail = (fromHeader: string): Email => {
                if(/<.+>/.test(fromHeader)) {
                  const emailAddressPart = fromHeader.match(/<.+>/)![0];
                  return {
                    emailAddress: emailAddressPart.substring(1, emailAddressPart.length-1).toLowerCase(),
                    name: fromHeader.split('<')[0].trim().match(/"?(?<name>[^"]+)"?/)!.groups!.name.trim(),
                    messages: [],
                    searchString: ''
                  }
                }
                else {
                  return {
                    emailAddress: fromHeader.toLowerCase(),
                    name: '',
                    messages: [],
                    searchString: ''
                  }
                }
              }

              // convert messages to Email objects with associated message
              const ununiqueEmails: Email[] = messageResults.map(messageResult => {
                const email: Email = convertEmail(messageResult.payload?.headers?.find(d => d.name === 'From')?.value!);
                email.messages.push(messageResult);
                return email;
              });

              // consolidate Emails with duplicate email addresses, combining messages into same arrays.
              const uniqueEmailAddresses = new Set();
              const uniqueEmails: Email[] = [];
              for(const ununiqueEmail of ununiqueEmails) {
                if(uniqueEmailAddresses.has(ununiqueEmail.emailAddress)) {
                  const foundEmail = uniqueEmails.find(email => email.emailAddress === ununiqueEmail.emailAddress)!;
                  foundEmail.messages = foundEmail.messages.concat(ununiqueEmail.messages);
                }
                else {
                  uniqueEmails.push(ununiqueEmail);
                  uniqueEmailAddresses.add(ununiqueEmail.emailAddress);
                }
              }

              // add school name if it can be found from collegeURLs requested from server.
              // also create a set of unknown urls to report to the server
              const unknownSchools = new Set<string>();
              for(const email of uniqueEmails) {
                const result = collegeURLs.find((collegeURL: CollegeURL) => new RegExp(`[@\.]${collegeURL.url}$`).test(email.emailAddress));
                if(typeof result !== 'undefined') {
                  email.school = result.name;
                }
                else {
                  unknownSchools.add(email.emailAddress.split('@')[1]);
                }
              }
              const individualEmails: Email[] = uniqueEmails
                .map((email: Email) => ({ 
                  ...email, 
                  searchString: (email.name + ' ' + email.emailAddress + ' ' + (email.school ?? '')).toLowerCase(),
                }));

              // perform post request for each unknown school
              for(const unknownSchool of unknownSchools) {
                try {
                  await axios.post(new URL('unknown-school', process.env.REACT_APP_API_URL).href, {
                    url: unknownSchool
                  });
                }
                catch {
                  // this doesn't really matter - if we get an error, fail silently and stop trying to send requests
                  break;
                }
              }

              // consolidate those with identical school names
              const uniqueEmailGroups: { [key: string]: EmailGroup } = {};
              for(const email of individualEmails) {
                const key = email.school ?? email.name;
                if(uniqueEmailGroups[key] === undefined) {
                  uniqueEmailGroups[key] = {
                    school: key,
                    searchString: email.searchString,
                    emails: [email]
                  }
                }
                else {
                  uniqueEmailGroups[key].searchString = uniqueEmailGroups[key].searchString += ' ' + email.searchString;
                  uniqueEmailGroups[key].emails.push(email);
                }
              }
              console.log(uniqueEmailGroups);

              // sort email groups by school, and sort each email group's emails alphabetically as well
              const sortedEmailGroups = Object.values(uniqueEmailGroups).sort((a, b) => a.school < b.school ? -1 : 1);
              for(const emailGroup of sortedEmailGroups) {
                emailGroup.emails.sort((a, b) => (a.name === '' ? a.school : a.name) < (b.name === '' ? b.school : b.name) ? -1 : 1)
              }

              setBlockedEmailGroups(sortedEmailGroups);
              setIsLoading(false);
            });
        });
    }
  }, [step]);


  // set filters on step 3
  useEffect(() => {
    if(step === 3 && !isLoading) {
      setIsLoading(true);
      gapi.client.gmail.users.labels.create({
        userId: 'me',
        resource: {
          name: `Modified by College Spam Guard (${filterMethod})`,
          labelListVisibility: 'labelHide',
          messageListVisibility: 'hide'
        }
      })
        .then(async labelResult => {
          setExtraMessage('Setting filters...');

          const { result: { id: labelID } } = labelResult;
          const actions = {
            addLabelIds: [
              labelID!,
              ...(filterMethod === 'trash' ? ['TRASH'] : []) // add trash tag if we're trashing
            ],
            removeLabelIds: [
              ...(filterMethod !== 'read' ? ['INBOX'] : ['UNREAD']) // remove inbox tag only if we're not marking as read
            ]
          };

          // create groups of email addresses in different filters, add calls to create filter to batch.
          const emailAddressGroups: string[][] = [[]];
          let blockedEmails: Email[] = [];
          for(const emailGroup of blockedEmailGroups) {
            blockedEmails = blockedEmails.concat(emailGroup.emails);
          }
          for(const email of blockedEmails) {
            if(emailAddressGroups[emailAddressGroups.length-1].length >= 30) emailAddressGroups.push([]);
            emailAddressGroups[emailAddressGroups.length-1].push(email.emailAddress);
          }
          
          // execute filter creations one by one to prevent dropped filter creations
          for(const emailAddressGroup of emailAddressGroups) {
            await gapi.client.gmail.users.settings.filters.create({
              userId: 'me',
              resource: {
                criteria: {
                  from: `{${emailAddressGroup.join(' ')}}`
                },
                action: actions
              }
            });
          }

          setExtraMessage('Looking for old emails to filter...');

          // generate array of queries to look for emails based on block list based on emailAddressGroups
          let queries = emailAddressGroups.map(emailAddressGroup => `after: 1970/01/01 from:{${emailAddressGroup.join(' ')}}`)
          let ids: string[] = [];
          let nextPageTokens: { [key: string]: string} = {};
          while(true) {
            const batch = gapi.client.newBatch();
            queries.forEach((query, i) => {
              batch.add(gapi.client.gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: 500,
                includeSpamTrash: true,
                pageToken: nextPageTokens[`${i}`]
              }), { id: `${i}`, callback: () => {} });
            });
            const { result: batchResult } = await batch; // run batch

            // run through each query, remove via returning false in filter if we've exhausted everything and add next page token to array for next pass
            let doBreak = true;
            queries = queries.filter((_, i) => {
              if(batchResult[`${i}`].result.resultSizeEstimate === 0) return false;
              ids = ids.concat(batchResult[`${i}`].result.messages.map((result: MinimalMessage) => result.id));
              if(batchResult[`${i}`].result.nextPageToken !== undefined) {
                nextPageTokens[`${i}`] = batchResult[`${i}`].result.nextPageToken;
                doBreak = false;
                return true;
              }
              else {
                delete nextPageTokens[`${i}`];
                return false;
              }
            });

            if(doBreak) break;
          }

          // split ids into multiple 1000-id arrays (max ids for batchModify)
          const idBatches: string[][] = [[]];
          for(const id of ids) {
            if(idBatches[idBatches.length-1].length === 1000) {
              idBatches.push([]);
            }
            idBatches[idBatches.length-1].push(id);
          }
          for(const idBatch of idBatches) {
            await gapi.client.gmail.users.messages.batchModify({
              userId: 'me',
              resource: {
                ...actions,
                ids: idBatch,
              }
            });
          }

          setExtraMessage('');
          setNumMessagesModified(ids.length);
          setIsLoading(false);
        });
    }
  }, [step]);


  // filter blocked emails for search results
  const blockedEmailsDisplay: EmailGroup[] = useMemo<EmailGroup[]>(() => {
    if(blockedEmailGroupsSearch === '') return blockedEmailGroups;
    return blockedEmailGroups.filter(emailGroup => {
      return emailGroup.searchString?.includes(blockedEmailGroupsSearch);
    });
  }, [blockedEmailGroupsSearch, blockedEmailGroups]);


  return <main>
    <Helmet>
      <title>Setup</title>
    </Helmet>
    <Modal show={showFilterConfirmation} onHide={() => setShowFilterConfirmation(false)}>
      <Modal.Header closeButton>
        <Modal.Title>Confirm filters</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Make sure that you're not blocking any colleges you want to hear from!
        </p>
        <p>
          If you later find out that you want to change your filters, don't worry. You can undo all of College Spam Guard's
          actions at any time.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant='secondary' onClick={() => setShowFilterConfirmation(false)}>
          Keep editing
        </Button>
        <Button variant='primary' className='ms-4' onClick={() => {
          setStep(3);
          setShowFilterConfirmation(false);
        }}>
          Finalize
        </Button>
      </Modal.Footer>
    </Modal>
    <div className='bg-secondary text-dark'>
      <Container fluid='sm' className='bg-secondary text-dark py-2' style={{ fontSize: '1.25rem' }}>
        <div className='d-flex justify-content-center align-content-center steps-container'>
          <div>
            <span className={`d-inline-block text-center me-3 border border-2 border-dark rounded-circle ${step >= 1 ? 'bg-dark text-secondary' : 'text-dark'}`} style={{ width: '1.875rem', height: '1.875rem', lineHeight: 'calc(1.875rem - 4px)' }}>
              1
            </span>
            Pick filter method
          </div>
          <div className='d-flex flex-column justify-content-center'>
            <div className='border-top border-2 border-dark steps-dash' style={{ height: '2px' }} />
          </div>
          <div>
            <span className={`d-inline-block text-center me-3 border border-2 border-dark rounded-circle ${step >= 2 ? 'bg-dark text-secondary' : 'text-dark'}`} style={{ width: '1.875rem', height: '1.875rem', lineHeight: 'calc(1.875rem - 4px)' }}>
              2
            </span>
            Configure whitelist
          </div>
          <div className='d-flex flex-column justify-content-center'>
            <div className='border-top border-2 border-dark steps-dash' style={{ height: '2px' }} />
          </div>
          <div>
            <span className={`d-inline-block text-center me-3 border border-2 border-dark rounded-circle ${step >= 3 ? 'bg-dark text-secondary' : 'text-dark'}`} style={{ width: '1.875rem', height: '1.875rem', lineHeight: 'calc(1.875rem - 4px)' }}>
              3
            </span>
            Review
          </div>
        </div>

      </Container>
    </div>
    {
      isLoading 
      ? <Container fluid='sm' className='text-center'>
        <p className='pt-4' style={{ fontSize: '3rem' }}>
          <FontAwesomeIcon icon={faSpinner} pulse />
        </p>
        <LoadingText loadingMessage={step === 2 ? 'Processing data' : 'Initializing filters'} extraMessage={extraMessage} />
      </Container>
      : step === 1
      ? <Container fluid='sm'>
        <h2 className='py-5 text-center'>Choose spam filter method</h2>
        <p className='pd-5 text-center'>The chosen method will be applied to any messages received in the future, and also applied retroactively to messages already received.</p>
        <CardGroup className='m-auto mb-5'>
          <Card className='card-hover-expand' style={{ cursor: 'pointer' }} onClick={() => {setStep(2); setFilterMethod('read');}}>
            <Card.Body>
              <Card.Text className='text-center'>
                <span className='twa twa-rolled-up-newspaper twa-5x' />
              </Card.Text>
              <Card.Title>Mark Spam as Read</Card.Title>
              <Card.Text>
                Spam messages will be marked as read, allowing them to still show up in your main inbox.
                This is applied to all previously received messages as well.
              </Card.Text>
            </Card.Body>
          </Card>
          <Card className='card-hover-expand' style={{ cursor: 'pointer' }} onClick={() => {setStep(2); setFilterMethod('archive');}}>
            <Card.Body>
              <Card.Text className='text-center'>
                <span className='twa twa-file-cabinet twa-5x' />
              </Card.Text>
              <Card.Title>Archive Spam</Card.Title>
              <Card.Text>
              Spam messages will be archived. You can still search for them, but they won't show up in your main inbox.
                They will, however, appear under "All Mail." This is applied to all previously received messages as well.
              </Card.Text>
            </Card.Body>
          </Card>
          <Card className='card-hover-expand' style={{ cursor: 'pointer' }} onClick={() => {setStep(2); setFilterMethod('trash');}}>
            <Card.Body>
              <Card.Text className='text-center'>
                <span className='twa twa-wastebasket twa-5x' />
              </Card.Text>
              <Card.Title>Trash Spam</Card.Title>
              <Card.Text>
                Spam messages will be moved to the trash, where they'll be fully deleted after 30 days. Messages received previously that
                fall under your specified filters will also be moved to trash.
              </Card.Text>
            </Card.Body>
          </Card>
        </CardGroup>
      </Container>
      : step === 2
      ? <Container fluid='sm'>
        <div className='d-flex my-5 configure-container'>
          <div style={{ flex: 1}} />
          <h2>Configure your filter list</h2>
          <div style={{ flex: 1 }}>
            <Button size='lg' onClick={() => setShowFilterConfirmation(true)}>
              Finalize filters
            </Button>
          </div>
        </div>
        <h2 className='my-5'>Make <u>sure</u> to whitelist schools you are <b>applying</b> to, were <b>accepted</b> to, or are <b>attending</b>!</h2>
        <h3>Whitelist</h3>
        <Card body className='setup-whitelist-container'>
          <Row className='email-container gy-4 gx-3'>
            {
              whitelistedEmailGroups.length === 0
              ? <Col className='w-100'>
                Click the icon to keep hearing from a college. Any whitelisted college will appear here.
              </Col>
              : whitelistedEmailGroups.map(emailGroup => <EmailInfo key={emailGroup.school} emailGroup={emailGroup} variant='block' onIconClick={(email?: Email) => {
                // undefined email indicates that we're blocking the whole email group.
                // undefined email may still only correspond to a single email that must be added to an existing blacklisted email group
                if(email === undefined) {
                  setWhitelistedEmailGroups(whitelistedEmailGroupsState => whitelistedEmailGroupsState.filter(d => d !== emailGroup));
                  setBlockedEmailGroups(blockedEmailGroupsState => {
                    const sameSchoolEmailGroupIndex = blockedEmailGroupsState.findIndex(d => d.school === emailGroup.school);
                    if(sameSchoolEmailGroupIndex !== -1) {
                      return [...blockedEmailGroupsState.slice(0, sameSchoolEmailGroupIndex), {
                        school: emailGroup.school,
                        emails: [...blockedEmailGroupsState[sameSchoolEmailGroupIndex].emails, ...emailGroup.emails],
                        searchString: blockedEmailGroupsState[sameSchoolEmailGroupIndex].searchString + ' ' + emailGroup.searchString
                      }, ...blockedEmailGroupsState.slice(sameSchoolEmailGroupIndex+1)];
                    }
                    else {
                      return [...blockedEmailGroupsState, {
                        school: emailGroup.school,
                        searchString: emailGroup.searchString,
                        emails: [...emailGroup.emails]
                      }];
                    }
                  });
                }
                else {
                  setWhitelistedEmailGroups(whitelistedEmailGroupsState => {
                    emailGroup.emails = emailGroup.emails.filter(d => d !== email);
                    emailGroup.searchString = emailGroup.emails.map(d => d.searchString).join(' ');
                    return [...whitelistedEmailGroupsState];
                  });
                  setBlockedEmailGroups(blockedEmailGroupsState => {
                    const sameSchoolEmailGroupIndex = blockedEmailGroupsState.findIndex(d => d.school === emailGroup.school);
                    if(sameSchoolEmailGroupIndex !== -1) {
                      return [...blockedEmailGroupsState.slice(0, sameSchoolEmailGroupIndex), {
                        school: emailGroup.school,
                        emails: [...blockedEmailGroupsState[sameSchoolEmailGroupIndex].emails, email],
                        searchString: blockedEmailGroupsState[sameSchoolEmailGroupIndex].searchString + ' ' + email.searchString
                      }, ...blockedEmailGroupsState.slice(sameSchoolEmailGroupIndex+1)];
                    }
                    else {
                      return [...blockedEmailGroupsState, {
                        school: emailGroup.school,
                        searchString: email.searchString,
                        emails: [email]
                      }];
                    }
                  });
                }
                
              }} />)
            }
          </Row>
        </Card>
        <h3 className='mt-5'>Blocked Schools</h3>
        <p>These schools will be blocked unless whitelisted manually</p>
        <Form.Group as={Row} className='mb-3'>
          <Form.Label column className='w-auto' style={{ flex: '0 0 auto' }}>
            Search:
          </Form.Label>
          <Col sm={4} style={{ minWidth: 'min(100%, 300px)' }}>
            <Form.Control placeholder='Type the name of a school....' value={blockedEmailGroupsSearch} onChange={e => setBlockedEmailGroupsSearch(e.target.value)} />
          </Col>
        </Form.Group>
        <Card body className='setup-blocked-container mb-5'>
          <Row className='email-container gy-4 gx-3'>
            {
              blockedEmailGroups.length === 0
              ? <Col className='w-100'>
                No spam sources blocked.
              </Col>
              : blockedEmailsDisplay.length === 0
              ? <Col className='w-100'>
                No results for the given search terms.
              </Col>
              : blockedEmailsDisplay.map(emailGroup => <EmailInfo key={emailGroup.school} emailGroup={emailGroup} variant='whitelist' onIconClick={(email?: Email) => {
                // undefined email indicates that we're adding the whole email group.
                // undefined email may still only correspond to a single email that must be added to an existing whitelisted email group
                if(email === undefined) {
                  setBlockedEmailGroups(blockedEmailGroupsState => blockedEmailGroupsState.filter(d => d !== emailGroup));
                  setWhitelistedEmailGroups(whitelistedEmailGroupsState => {
                    const sameSchoolEmailGroupIndex = whitelistedEmailGroupsState.findIndex(d => d.school === emailGroup.school);
                    if(sameSchoolEmailGroupIndex !== -1) {
                      return [...whitelistedEmailGroupsState.slice(0, sameSchoolEmailGroupIndex), {
                        school: emailGroup.school,
                        emails: [...whitelistedEmailGroupsState[sameSchoolEmailGroupIndex].emails, ...emailGroup.emails],
                        searchString: whitelistedEmailGroupsState[sameSchoolEmailGroupIndex].searchString + ' ' + emailGroup.searchString
                      }, ...whitelistedEmailGroupsState.slice(sameSchoolEmailGroupIndex+1)];
                    }
                    else {
                      return [...whitelistedEmailGroupsState, {
                        school: emailGroup.school,
                        searchString: emailGroup.searchString,
                        emails: [...emailGroup.emails]
                      }];
                    }
                  });
                }
                else {
                  setBlockedEmailGroups(blockedEmailGroupsState => {
                    emailGroup.emails = emailGroup.emails.filter(d => d !== email);
                    emailGroup.searchString = emailGroup.emails.map(d => d.searchString).join(' ');
                    return [...blockedEmailGroupsState];
                  });
                  setWhitelistedEmailGroups(whitelistedEmailGroupsState => {
                    const sameSchoolEmailGroupIndex = whitelistedEmailGroupsState.findIndex(d => d.school === emailGroup.school);
                    if(sameSchoolEmailGroupIndex !== -1) {
                      return [...whitelistedEmailGroupsState.slice(0, sameSchoolEmailGroupIndex), {
                        school: emailGroup.school,
                        emails: [...whitelistedEmailGroupsState[sameSchoolEmailGroupIndex].emails, email],
                        searchString: whitelistedEmailGroupsState[sameSchoolEmailGroupIndex].searchString + ' ' + email.searchString
                      }, ...whitelistedEmailGroupsState.slice(sameSchoolEmailGroupIndex+1)];
                    }
                    else {
                      return [...whitelistedEmailGroupsState, {
                        school: emailGroup.school,
                        searchString: email.searchString,
                        emails: [email]
                      }];
                    }
                  });
                }
                
              }} />)
            }  
          </Row>
        </Card>
      </Container>
      : <Container fluid='sm'>
        <h2 className='mt-5 text-center'>You're all done!</h2>
        <h5 className='text-center'>You can now close this tab. All the filters will work automatically and indefinitely.</h5>
        <h5 className='text-center mb-5'>
          Or, <Link to='/manage'>manage your filters</Link>.
        </h5>
        <p className='my-4 text-center' style={{ fontSize: '1.25rem' }}>Spam is being <span className='p-2 bg-secondary rounded'>{filterMethod === 'read' ? 'marked as read' : filterMethod === 'archive' ? 'archived' : 'trashed'}</span></p>
        <p className='my-4 text-center' style={{ fontSize: '1.25rem' }}><span className='p-2 bg-secondary rounded'>{blockedEmailGroups.length}</span> email address blocked</p>
        <p className='my-4 text-center' style={{ fontSize: '1.25rem' }}><span className='p-2 bg-secondary rounded'>{numMessagesModified}</span> messages retroactively modified</p>
        <h3 className='mt-5'>The following schools are whitelisted:</h3>
        <Card body className='setup-whitelist-container mb-5'>
          <Row className='email-container gy-4 gx-3'>
            {
              whitelistedEmailGroups.length === 0
              ? <Col className='w-100'>
                No emails whitelisted
              </Col>
              : whitelistedEmailGroups.map(emailGroup => <EmailInfo key={emailGroup.school} emailGroup={emailGroup} variant='block' button={false} />)
            }
          </Row>
        </Card>
      </Container>
    }
  </main>
}

export default Setup;