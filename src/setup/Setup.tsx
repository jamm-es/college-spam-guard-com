import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, CardGroup, Col, Container, Form, Modal, Row } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import LoadingText from "./LoadingText";
import Email from './Email';
import credentials from '../credentials.json';
import api from '../api.json';
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
  const [whitelistedEmails, setWhitelistedEmails] = useState<Email[]>([]);
  const [blockedEmails, setBlockedEmails] = useState<Email[]>([]);
  const [blockedEmailsSearch, setBlockedEmailsSearch] = useState<string>('');
  const [potentialEmails, setPotentialEmails] = useState<Email[]>([]);
  const [potentialEmailsSearch, setPotentialEmailsSearch] = useState<string>('');
  const [showFilterConfirmation, setShowFilterConfirmation] = useState<boolean>(false);
  const [numMessagesModified, setNumMessagesModified] = useState<number>(0);

  const navigate = useNavigate();
  

  // initiate gapi
  useEffect(() => {
    gapi.load('client:auth2', () => {
      gapi.client.init({
        apiKey: credentials.apiKey,
        clientId: credentials.clientId,
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
      Promise.all([
        axios.get(new URL('blocked-emails', api.url).href),
        axios.get(new URL('college-urls', api.url).href)
      ])
        .then(([{ data: blockedEmails }, { data: collegeURLs }]) => {

          type BlockedEmail = {
            emailAddress: string,
            isEdu: boolean,
            school: string,
            name: string,
          };

          type CollegeURL = {
            url: string,
            isEdu: boolean,
            name: string
          };

          const listBatch = gapi.client.newBatch();
          const collegeURLSearchTerm = `from:{*@*.edu ${blockedEmails.filter((d: BlockedEmail) => !d.isEdu).map((d: BlockedEmail) => d.emailAddress).join(' ')}}`;
          // knownPass - get edus and exceptions to search ONLY for known spam sources (including fully qualified, etc)
          listBatch.add(gapi.client.gmail.users.messages.list({
            userId: 'me',
            maxResults: 500,
            includeSpamTrash: true,
            q: `after: 1970/01/01 ${collegeURLSearchTerm}` // or exceptions from server check list
          }), { id: 'knownPass', callback: () => {} });

          // potentialPass - search for likely spammers
          listBatch.add(gapi.client.gmail.users.messages.list({ 
            userId: 'me',
            maxResults: 500,
            includeSpamTrash: true,
            q: 'after: 1970/01/01'
              + '(unsubscribe OR subscribe OR subscription OR (update AROUND 5 preferences) OR (change AROUND 5 preferences) OR (email AROUND 5 preferences) OR (update AROUND 5 email))'
              + `(from:{college university admission admissions school} OR ${collegeURLSearchTerm})` // or exceptions from server check list
          }), { id: 'potentialPass', callback: () => {} });
          
          listBatch.then(async ({ result: { knownPass: { result: knownPass }, potentialPass: { result: potentialPass }} }) => {
            const allIDs = new Set<string>();
            knownPass.messages.forEach((d: MinimalMessage) => allIDs.add(d.id));
            potentialPass.messages.forEach((d: MinimalMessage) => allIDs.add(d.id));

            let messageCount = 0;
            const messageBatches = [];
            const numMessagesAtEachBatch = [];
            for(const id of allIDs) {
              if(messageCount % 50 === 0) {
                numMessagesAtEachBatch.push(messageCount);
                messageBatches.push(gapi.client.newBatch());
              }

              messageBatches[messageBatches.length-1].add(gapi.client.gmail.users.messages.get({
                userId: 'me',
                id: id,
                format: 'metadata',
                metadataHeaders: ['From', 'Subject']
              }), { id: id, callback: () => {} });

              ++messageCount;
            }

            const messageBatchResults = [];
            let messageBatchIndex = 0;
            for(const messageBatch of messageBatches) {
              setExtraMessage(`Loading emails (${numMessagesAtEachBatch[messageBatchIndex]}/${messageCount})`);
              messageBatchResults.push(await messageBatch); // run batch
              if(messageBatchIndex !== messageBatches.length-1) await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 second for rate limiting
              ++messageBatchIndex;
            }
            setExtraMessage('');

            const messages: { [key: string] : any } = {};
            for(const messageBatch of messageBatchResults) {
              for(const [key, value] of Object.entries(messageBatch.result)) {
                messages[key] = value.result;
              }
            }

            type Header = { name: string, value: string };

            const convertEmail = (fromHeader: string): Email => {
              if(/<.+>/.test(fromHeader)) {
                const emailAddressPart = fromHeader.match(/<.+>/)![0];
                return {
                  emailAddress: emailAddressPart.substring(1, emailAddressPart.length-1).toLowerCase(),
                  name: fromHeader.split('<')[0].trim().match(/"?(?<name>[^"]+)"?/)!.groups!.name.trim(),
                  message: {}
                }
              }
              else {
                return {
                  emailAddress: fromHeader.toLowerCase(),
                  name: '',
                  message: {}
                }
              }
            }

            const knownMessages = knownPass.messages.map((d: MinimalMessage) => messages[d.id]);
            const knownEmails = knownMessages.map((message: any) => {
              const email: Email = convertEmail(message.payload.headers.find((d: Header) => d.name === 'From').value);
              email.message = message;
              return email;
            });
            const knownEmailsSeenSoFar = new Set();
            const uniqueKnownEmails = [];
            for(const knownEmail of knownEmails) {
              if(knownEmailsSeenSoFar.has(knownEmail.emailAddress)) continue;
              uniqueKnownEmails.push(knownEmail);
              knownEmailsSeenSoFar.add(knownEmail.emailAddress);
            }
            const filteredKnownEmails = uniqueKnownEmails.filter((email: Email) => {
              const result = blockedEmails.find((blockedEmail: BlockedEmail) => blockedEmail.emailAddress === email.emailAddress);
              if(typeof result !== 'undefined') {
                email.school = result.school;
                email.name = result.name;
                return true;
              }
              return false;
            })
              .map((email: Email) => ({ 
                ...email, 
                searchString: email.searchString = (email.name + ' ' + email.emailAddress + ' ' + (email.school ?? '')).toLowerCase(),
              }));

            const potentialMessages = potentialPass.messages.map((d: MinimalMessage) => messages[d.id]);
            const potentialEmails = potentialMessages.map((message: any) => {
              const email: Email = convertEmail(message.payload.headers.find((d: Header) => d.name === 'From').value);
              email.message = message;
              return email;
            });
            const potentialEmailsSeenSoFar = new Set();
            const uniquePotentialEmails = [];
            for(const potentialEmail of potentialEmails) {
              if(potentialEmailsSeenSoFar.has(potentialEmail.emailAddress)) continue;
              uniquePotentialEmails.push(potentialEmail);
              potentialEmailsSeenSoFar.add(potentialEmail.emailAddress);
            }
            const filteredUnknownEmails: Email[] = [];
            const filteredPotentialEmails = uniquePotentialEmails.filter((email: Email) => {
              const result = collegeURLs.find((collegeURL: CollegeURL) => new RegExp(`[@\.]${collegeURL.url}$`).test(email.emailAddress));
              if(typeof result === 'undefined') {
                filteredUnknownEmails.push(email);
                return false;
              }
              email.school = result.name;
              return true;
            });

            const combinedFilteredPotentialEmails = filteredPotentialEmails.concat(filteredUnknownEmails)
              .map((email: Email) => ({ 
                ...email, 
                searchString: email.searchString = (email.name + ' ' + email.emailAddress + ' ' + (email.school ?? '')).toLowerCase(),
              }));

            filteredKnownEmails.sort((a, b) => (a.school ?? a.name) < (b.school ?? b.name) ? -1 : 1);
            combinedFilteredPotentialEmails.sort((a, b) => (a.school ?? a.name) < (b.school ?? b.name) ? -1 : 1);

            setBlockedEmails(filteredKnownEmails);
            setPotentialEmails(combinedFilteredPotentialEmails);
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
        .then(labelResult => {
          setExtraMessage('Setting filters...');

          const { result: { id: labelID } } = labelResult;
          const allFilterCreationRequests: gapi.client.Request<any>[] = [];
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
          for(const email of blockedEmails) {
            if(emailAddressGroups[emailAddressGroups.length-1].length >= 30) emailAddressGroups.push([]);
            emailAddressGroups[emailAddressGroups.length-1].push(email.emailAddress);
          }
          for(const emailAddressGroup of emailAddressGroups) {
            allFilterCreationRequests.push(gapi.client.gmail.users.settings.filters.create({
              userId: 'me',
              resource: {
                criteria: {
                  from: `{${emailAddressGroup.join(' ')}}`
                },
                action: actions
              }
            }));
          }

          // put requests into batches of 25, then execute
          const allFilterCreationBatches: gapi.client.Batch<any>[] = [gapi.client.newBatch()];
          let numAdded = 0;
          for(const filterCreationRequest of allFilterCreationRequests) {
            if(numAdded === 25) { // fewer in batch because of potentially long filter messages 
              allFilterCreationBatches.push(gapi.client.newBatch());
              numAdded = 0;
            }
            allFilterCreationBatches[allFilterCreationBatches.length-1].add(filterCreationRequest);
            ++numAdded;
          }

          Promise.all(allFilterCreationBatches)
            .then(async res => {
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

              gapi.client.gmail.users.messages.batchModify({
                userId: 'me',
                resource: {
                  ...actions,
                  ids: ids,
                }
              })
                .then(() => {
                  setExtraMessage('');
                  setNumMessagesModified(ids.length);
                  setIsLoading(false);
                });
            });
        });
    }
  }, [step]);


  // filter blocked emails for search results
  const blockedEmailsDisplay: Email[] = useMemo<Email[]>(() => {
    if(blockedEmailsSearch === '') return blockedEmails;
    return blockedEmails.filter(email => {
      return email.searchString?.includes(blockedEmailsSearch);
    });
  }, [blockedEmailsSearch, blockedEmails]);

  const potentialEmailsDisplay: Email[] = useMemo<Email[]>(() => {
    if(potentialEmailsSearch === '') return potentialEmails;
    return potentialEmails.filter(email => {
      return email.searchString?.includes(potentialEmailsSearch);
    });
  }, [potentialEmailsSearch, potentialEmails]);


  return <main>
    <Modal show={showFilterConfirmation} onHide={() => setShowFilterConfirmation(false)}>
      <Modal.Header closeButton>
        <Modal.Title>Confirm filters</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Note that only the email addresses listed under "Blocked Schools" will be filtered. Addresses that are part of the whitelist or are listed as
          "Potential Sources of Spam" will be completely unaffected.
        </p>
        <p>
          Once the filters are set up, they can still be removed if you want to undo your actions.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant='secondary' onClick={() => setShowFilterConfirmation(false)}>
          Keep editing
        </Button>
        <Button variant='primary' onClick={() => {
          setStep(3);
          setShowFilterConfirmation(false);
        }}>
          Finalize
        </Button>
      </Modal.Footer>
    </Modal>
    <div className='bg-secondary text-dark'>
      <Container fluid='sm' className='bg-secondary text-dark py-2' style={{ fontSize: '1.25rem' }}>
        <div className='d-flex justify-content-center align-content-center' style={{ gap: '1.5rem' }}>
          <div>
            <span className={`d-inline-block text-center me-3 border border-2 border-dark rounded-circle ${step >= 1 ? 'bg-dark text-secondary' : 'text-dark'}`} style={{ width: '1.875rem', height: '1.875rem', lineHeight: 'calc(1.875rem - 4px)' }}>
              1
            </span>
            Choose spam filter method
          </div>
          <div className='d-flex flex-column justify-content-center'>
            <div className='border-top border-2 border-dark' style={{ width: '3rem', height: '2px' }} />
          </div>
          <div>
            <span className={`d-inline-block text-center me-3 border border-2 border-dark rounded-circle ${step >= 2 ? 'bg-dark text-secondary' : 'text-dark'}`} style={{ width: '1.875rem', height: '1.875rem', lineHeight: 'calc(1.875rem - 4px)' }}>
              2
            </span>
            Configure whitelist
          </div>
          <div className='d-flex flex-column justify-content-center'>
            <div className='border-top border-2 border-dark' style={{ width: '3rem', height: '2px' }} />
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
        <CardGroup className='m-auto'>
          <Card className='card-hover-expand' style={{ cursor: 'pointer' }} onClick={() => {setStep(2); setFilterMethod('read');}}>
            <Card.Body>
              <Card.Text className='text-center'>
                <span className='twa twa-see-no-evil-monkey twa-5x' />
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
                <span className='twa twa-bullseye twa-5x' />
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
                <span className='twa twa-no-entry twa-5x' />
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
        <div className='d-flex py-5'>
          <div style={{ flex: 1}} />
          <h2>Choose spam filter method</h2>
          <div className='text-end' style={{ flex: 1 }}>
            <Button size='lg' onClick={() => setShowFilterConfirmation(true)}>
              Finalize filters
            </Button>
          </div>
        </div>
        <h3>Whitelist</h3>
        <Card body className='setup-whitelist-container'>
          <Row className='row-cols-4 gy-4 gx-3'>
            {
              whitelistedEmails.length === 0
              ? <Col className='w-100'>
                Click the icon to keep hearing from a college. Any whitelisted college will appear here.
              </Col>
              : whitelistedEmails.map(email => <EmailInfo key={email.emailAddress} email={email} variant='block' onIconClick={() => {
                setWhitelistedEmails(whiteListedEmailsState => whiteListedEmailsState.filter(d => d !== email));
                setBlockedEmails(knownEmailsState => [...knownEmailsState, email]);
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
          <Col sm={4}>
            <Form.Control placeholder='Type the name of a school....' value={blockedEmailsSearch} onChange={e => setBlockedEmailsSearch(e.target.value)} />
          </Col>
        </Form.Group>
        <Card body className='setup-blocked-container'>
          <Row className='row-cols-4 gy-4 gx-3'>
            {
              blockedEmails.length === 0
              ? <Col className='w-100'>
                No spam sources blocked.
              </Col>
              : blockedEmailsDisplay.length === 0
              ? <Col className='w-100'>
                No results for the given search terms.
              </Col>
              : blockedEmailsDisplay.map(email => <EmailInfo key={email.emailAddress} email={email} variant='whitelist' onIconClick={() => {
                setBlockedEmails(knownEmailsState => knownEmailsState.filter(d => d !== email));
                setWhitelistedEmails(whiteListedEmailsState => [...whiteListedEmailsState, email]);
              }} />)
            }  
          </Row>
        </Card>
        <h3 className='mt-5'>Potential Spam Addresses</h3>
        <p>These addresses WON'T be blocked unless manually added to the filter list.</p>
        <Form.Group as={Row} className='mb-3'>
          <Form.Label column className='w-auto' style={{ flex: '0 0 auto' }}>
            Search:
          </Form.Label>
          <Col sm={4}>
            <Form.Control placeholder='Type the name of a school....' value={potentialEmailsSearch} onChange={e => setPotentialEmailsSearch(e.target.value)} />
          </Col>
        </Form.Group>
        <Card body className='setup-potential-container'>
          <Row className='row-cols-4 gy-4 gx-3'>
            {
              potentialEmails.length === 0
              ? <Col className='w-100'>
                No potential spam sources listed.
              </Col>
              : potentialEmailsDisplay.length === 0
              ? <Col className='w-100'>
                No results for the given search terms.
              </Col>
              : potentialEmailsDisplay.map(email => <EmailInfo key={email.emailAddress} email={email} variant='block' onIconClick={() => {
                setPotentialEmails(potentialEmailsState => potentialEmailsState.filter(d => d !== email));
                setBlockedEmails(knownEmailsState => [...knownEmailsState, email]);
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
        <p className='my-4 text-center' style={{ fontSize: '1.25rem' }}><span className='p-2 bg-secondary rounded'>{blockedEmails.length}</span> email address blocked</p>
        <p className='my-4 text-center' style={{ fontSize: '1.25rem' }}><span className='p-2 bg-secondary rounded'>{numMessagesModified}</span> messages retroactively modified</p>
        <h3 className='mt-5'>The following schools are whitelisted:</h3>
        <Card body className='setup-whitelist-container'>
          <Row className='row-cols-4 gy-4 gx-3'>
            {
              whitelistedEmails.length === 0
              ? <Col className='w-100'>
                No emails whitelisted
              </Col>
              : whitelistedEmails.map(email => <EmailInfo key={email.emailAddress} email={email} variant='block' button={false} />)
            }
          </Row>
        </Card>
      </Container>
    }
    {
      step === 2 && <Container fluid='sm' style={{ height: '5rem' }}>
        <Button className='position-absolute' variant='outline-dark' style={{ bottom: '1rem' }} onClick={() => setStep(step-1)}>
          Go back
        </Button>
      </Container>
    }
  </main>
}

export default Setup;