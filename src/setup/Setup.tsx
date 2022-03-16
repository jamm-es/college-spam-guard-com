import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { solid } from '@fortawesome/fontawesome-svg-core/import.macro';
import { Button, Col, Container, Row } from "react-bootstrap";

import credentials from '../credentials.json';

function Setup(props: {}) {

  const [ step, setStep ] = useState(1);

  const updateSignInStatus = (isSignedIn: Boolean) => {
    if(isSignedIn) {

    }
  }

  let singInButtonHandler = () => gapi.auth2.getAuthInstance().signIn({ prompt: 'select_account', ux_mode: 'redirect' });

  useEffect(() => {
    gapi.load('client:auth2', () => {
      gapi.client.init({
        apiKey: credentials.apiKey,
        clientId: credentials.clientId,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
        scope: 'https://www.googleapis.com/auth/gmail.readonly'
      });
    });
  }, []);

  return <main>
    <div className='bg-secondary text-dark'>
      <Container fluid='sm' className='bg-secondary text-dark py-2' style={{ fontSize: '1.25rem' }}>
        <div className='d-flex'>
          <div>
            <span className='fa-stack'>
              <FontAwesomeIcon icon={solid('1')} />
            </span>
            - blah blah
          </div>
          <div>
            2 - blah blah
          </div>
          <div>
            3 - blah blah
          </div>
        </div>
        
      </Container>
    </div>
    {
      step === 1
      ? <Container fluid='sm'>
        <Button onClick={singInButtonHandler}>Sign in</Button>
      </Container>
      : step === 2
      ? <Container fluid='sm'>
      </Container>
      : <Container fluid='sm'>
      </Container>
    }
  </main>
}

export default Setup;