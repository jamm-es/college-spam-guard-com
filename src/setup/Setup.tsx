import { useEffect, useState } from "react";
import { Button, Card, CardGroup, Container } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from '@fortawesome/free-brands-svg-icons';

import credentials from '../credentials.json';

function Setup(props: {}) {

  const [step, setStep] = useState(1);
  const [basicProfile, setBasicProfile] = useState<gapi.auth2.BasicProfile | undefined>(undefined);
  const [filterMethod, setFilterMethod] = useState<'hide' | 'mark' | 'block' | 'nuke' | undefined>(undefined);

  if(window.location.href.includes('prompt') && step === 1) {
    setStep(2);
  }

  let singInButtonHandler = () => gapi.auth2.getAuthInstance().signIn({ prompt: 'select_account', ux_mode: 'redirect' });
  
  useEffect(() => {
    gapi.load('client:auth2', () => {
      gapi.client.init({
        apiKey: credentials.apiKey,
        clientId: credentials.clientId,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
        scope: 'https://www.googleapis.com/auth/gmail.readonly'
      })
        .then(() => {
          const googleAuth = gapi.auth2.getAuthInstance();

          if(googleAuth.isSignedIn.get()) {
            const googleUser = googleAuth.currentUser.get();
            setBasicProfile(googleUser.getBasicProfile());
          }

          // because we redirect to the google SSO page in the same tab, it's unlikely that this handler ever gets called
          googleAuth.isSignedIn.listen((isSignedIn: Boolean) => {
            if(isSignedIn) {
              setStep(2);
            }
          });
        });
    });
  }, []);

  return <main>
    <div className='bg-secondary text-dark'>
      <Container fluid='sm' className='bg-secondary text-dark py-2' style={{ fontSize: '1.25rem' }}>
        <div className='d-flex justify-content-center align-content-center' style={{ gap: '1.5rem' }}>
          <div>
            <span className={`d-inline-block text-center me-3 border border-2 border-dark rounded-circle ${step >= 1 ? 'bg-dark text-secondary' : 'text-dark'}`} style={{ width: '1.875rem', height: '1.875rem', lineHeight: 'calc(1.875rem - 4px)' }}>1</span>
            Sign in to your email account
          </div>
          <div className='d-flex flex-column justify-content-center'>
            <div className='border-top border-2 border-dark' style={{ width: '3rem', height: '2px' }} />
          </div>
          <div>
          <span className={`d-inline-block text-center me-3 border border-2 border-dark rounded-circle ${step >= 2 ? 'bg-dark text-secondary' : 'text-dark'}`} style={{ width: '1.875rem', height: '1.875rem', lineHeight: 'calc(1.875rem - 4px)' }}>2</span>
            Choose spam filter method
          </div>
          <div className='d-flex flex-column justify-content-center'>
            <div className='border-top border-2 border-dark' style={{ width: '3rem', height: '2px' }} />
          </div>
          <div>
          <span className={`d-inline-block text-center me-3 border border-2 border-dark rounded-circle ${step >= 3 ? 'bg-dark text-secondary' : 'text-dark'}`} style={{ width: '1.875rem', height: '1.875rem', lineHeight: 'calc(1.875rem - 4px)' }}>3</span>
            Pick colleges to whitelist
          </div>
        </div>

      </Container>
    </div>
    {
      step === 1
      ? <Container fluid='sm' className='text-center'>
        <h2 className='py-5'>Sign in to your email account</h2>
        <div className='m-auto' style={{ width: '300px' }}>
          <Button className='w-100' variant='outline-primary' onClick={singInButtonHandler}>
            <FontAwesomeIcon icon={faGoogle} /> Sign in with Google
          </Button>
          {
            typeof basicProfile !== 'undefined' && <>
              <hr />
              <Button className='w-100' variant='secondary' onClick={() => setStep(2)}>
                <img className='d-inline-block rounded-circle' style={{ width: '1.5rem', height: '1.5rem' }} src={basicProfile.getImageUrl()} referrerPolicy='no-referrer' /> Continue as {basicProfile.getName()}
              </Button>
            </>
          }
          
        </div>
      </Container>
      : step === 2
      ? <Container fluid='sm'>
        <h2 className='py-5 text-center'>Choose spam filter method</h2>
        <CardGroup className='m-auto'>
          <Card className='card-hover-expand' style={{ cursor: 'pointer' }} onClick={() => {setStep(3); setFilterMethod('hide');}}>
            <Card.Body>
              <Card.Text className='text-center'>
                <span className='twa twa-see-no-evil-monkey twa-5x' />
              </Card.Text>
              <Card.Title>Hide Spam</Card.Title>
              <Card.Text>
                Spam messages will be archived. You can still search for them, but they won't show up in your main inbox.
              </Card.Text>
            </Card.Body>
          </Card>
          <Card className='card-hover-expand' style={{ cursor: 'pointer' }} onClick={() => {setStep(3); setFilterMethod('mark');}}>
            <Card.Body>
              <Card.Text className='text-center'>
                <span className='twa twa-bullseye twa-5x' />
              </Card.Text>
              <Card.Title>Mark Spam</Card.Title>
              <Card.Text>
                Spam messages will be marked as spam, meaning that they'll be removed from your inbox and deleted in 30 days.
              </Card.Text>
            </Card.Body>
          </Card>
          <Card className='card-hover-expand' style={{ cursor: 'pointer' }} onClick={() => {setStep(3); setFilterMethod('block');}}>
            <Card.Body>
              <Card.Text className='text-center'>
                <span className='twa twa-no-entry twa-5x' />
              </Card.Text>
              <Card.Title>Block Spam</Card.Title>
              <Card.Text>
                Spam messages will be blocked, preventing <i>ALL</i> spam from reaching your email in any fashion.
              </Card.Text>
            </Card.Body>
          </Card>
          <Card className='card-hover-expand' style={{ cursor: 'pointer' }} onClick={() => {setStep(3); setFilterMethod('nuke');}}>
            <Card.Body>
              <Card.Text className='text-center'>
                <span className='twa twa-bomb twa-5x' />
              </Card.Text>
              <Card.Title>Nuke Spam</Card.Title>
              <Card.Text>
                Spam messages will be blocked, preventing <i>ALL</i> spam from reaching your email in any fashion. All college spam already received
                will also be deleted.
              </Card.Text>
            </Card.Body>
          </Card>
        </CardGroup>
      </Container>
      : <Container fluid='sm'>
        <h2 className='py-5'>Choose colleges to whitelist</h2>
      </Container>
    }
  </main>
}

export default Setup;