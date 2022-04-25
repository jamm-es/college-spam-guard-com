import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { Button, Container, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';

function Manage(props: {}) {

  const [CSGLabel, setCSGLabel] = useState<gapi.client.gmail.Label>();
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState<boolean>(false);
  const [showRemoveSpinner, setShowRemoveSpinner] = useState<boolean>(false);
  const [blockedEmails, setBlockedEmails] = useState<string[]>([]);

  const navigate = useNavigate();
  

  // initiate gapi and check statuses
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

          // check if account was already modified by CSG. If not, redirect to homepage.
          gapi.client.gmail.users.labels.list({
            userId: 'me'
          })
            .then(({ result: { labels: labels } }) => {
              const foundLabel = labels?.find(label => label.name?.startsWith('Modified by College Spam Guard'));
              if(foundLabel === undefined) {
                navigate('/');
                return; // stop execution of useEffect on now unmounted component
              }
              else {
                // if there is a label that we modified this account before, store it for later use
                setCSGLabel(foundLabel);

                // read filters to display list of blocked emails
                gapi.client.gmail.users.settings.filters.list({
                  userId: 'me',
                })
                  .then(({ result: { filter: filters } }) => {
                    const CSGFilters = filters?.filter(filter => filter.action?.addLabelIds?.includes(foundLabel?.id!))!;
                    let emails: string[] = [];
                    for(const CSGFilter of CSGFilters) {
                      const fromCriteria = CSGFilter.criteria?.from!;
                      emails = emails.concat(fromCriteria.substring(1, fromCriteria.length-1).split(' '));
                    }
                    setBlockedEmails(emails);
                  });
              }
            });
        });
    });
  }, []);


  const removeFromAccount = async () => {
    // function needs to be seperated so we can continue whether or not there are filters to remove
    const removeOldMessagesAndLabel = async () => {
      // get list of ids we modified
      let ids: string[] = [];
      const queryArgs: { userId: string, maxResults: number, includeSpamTrash: boolean, labelIds: string[], pageToken: undefined | string } = {
        userId: 'me',
        maxResults: 500,
        includeSpamTrash: true,
        labelIds: [CSGLabel?.id!],
        pageToken: undefined
      };
      let finishedLoading = false;
      while(!finishedLoading) {
        const { result: result } = await gapi.client.gmail.users.messages.list(queryArgs);
        if(result.resultSizeEstimate === undefined) break;
        ids = ids.concat(result.messages?.map(message => message.id!)!);
        if(result.nextPageToken !== undefined) {
          queryArgs.pageToken = result.nextPageToken;
        }
        else {
          finishedLoading = true;
        }
      }

      // remove label and navigate away
      const removeLabelAndEnd = () => {
        gapi.client.gmail.users.labels.delete({
          userId: 'me',
          id: CSGLabel?.id!
        })
          .then(() => {
            navigate('/');
            return;
          })
          .catch(() => {
            // sometimes 404s
            navigate('/');
            return;
          })
      }

      // figure out what modification we made
      const modification = CSGLabel?.name?.match(/\(([a-z]+)\)/)![1];

      // split ids into groups of 1000, then wait for them all to execute
      const idGroups: string[][] = [[]];
      for(const id of ids) {
        if(idGroups[idGroups.length-1].length === 1000) idGroups.push([]);
        idGroups[idGroups.length-1].push(id);
      }
      const batchModifications: gapi.client.Request<any>[] = [];
      for(const idGroup of idGroups) {
        batchModifications.push(gapi.client.gmail.users.messages.batchModify({
          userId: 'me',
          resource: {
            ids: idGroup,
            addLabelIds: [modification === 'read' ? 'UNREAD' : 'INBOX'],
            removeLabelIds: [CSGLabel?.id!, ...(modification === 'trash' ? ['TRASH'] : [])]
          }
        }));
      }
      Promise.all(batchModifications)
        .then(() => {
          removeLabelAndEnd();
        })
        .catch(() => {
          // batchModify errors if ids is empty
          removeLabelAndEnd();
        })
    }

    // remove filters
    gapi.client.gmail.users.settings.filters.list({
      userId: 'me',
    })
      .then(({ result: { filter: filters } }) => {
        const filterIds = filters?.filter(filter => filter.action?.addLabelIds?.includes(CSGLabel?.id!)).map(filter => filter.id!)!;
        const filterBatch = gapi.client.newBatch();
        for(const filterId of filterIds) {
          filterBatch.add(gapi.client.gmail.users.settings.filters.delete({
            userId: 'me',
            id: filterId
          }));
        }
        if(filterIds.length === 0) removeOldMessagesAndLabel();
        else filterBatch.then(removeOldMessagesAndLabel);
      });
  }

  
  return <main>
    <Helmet>
      <title>Manage Email</title>
    </Helmet>
    <Modal show={showRemoveConfirmation} onHide={() => setShowRemoveConfirmation(false)}>
      <Modal.Header closeButton>
        <Modal.Title>Confirm removal</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Proceeding with the removal of College Spam Guard will remove all filters this website applied to your email account.
          It will also go back and undo all of the actions applied to all college spam emails the website affected.
        </p>
        <p>
          Messages that were trashed for more than 30 days will have already been permanently deleted and are not recoverable with this action.
        </p>
        <p>Removing College Spam Guard will leave your inbox vulnerable to spam again. Are you sure you with to proceed?</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant='primary' onClick={() => setShowRemoveConfirmation(false)}>
          Go back
        </Button>
        <Button variant='danger' onClick={() => {
          setShowRemoveSpinner(true);
          removeFromAccount();
        }}>
          Remove permanently {showRemoveSpinner && <FontAwesomeIcon icon={faSpinner} pulse />}
        </Button>
      </Modal.Footer>
    </Modal>
    <Container fluid='sm' className='text-center py-3'>
      <h2 className='mt-4'>Manage your account</h2>
      <p className='mb-5'>
        Your email account, <u>{gapi.auth2 !== undefined && gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getEmail()}</u>,
        has already been modified by College Spam Guard.
      </p>
      <div className='mb-5 mt-n3'>
        <Button className='me-4 mt-3' variant='secondary' onClick={() => {
          gapi.auth2.getAuthInstance().signOut();
          navigate('/');
        }}>
          Log out
        </Button>
        <Button className='mt-3' variant='danger' onClick={() => setShowRemoveConfirmation(true)}>
          Completely remove College Spam Guard
        </Button>
      </div>
      <h5 className='text-start'>Blocked emails</h5>
      <ul className='text-start'>
        {blockedEmails.map(email => <li key={email}>{email}</li>)}
      </ul>
    </Container>
  </main>
}

export default Manage;