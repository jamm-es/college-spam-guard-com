import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { Alert, Button, Container } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

function SignIn(props: {}) {

  const [basicProfile, setBasicProfile] = useState<gapi.auth2.BasicProfile | undefined>(undefined);
  const [hasPerms, setHasPerms] = useState<boolean>(true);

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
          const googleAuth = gapi.auth2.getAuthInstance();
          const googleUser = googleAuth.currentUser.get();

          if(googleAuth.isSignedIn.get()) {
            setBasicProfile(googleUser.getBasicProfile());
          }

          const hasPerms = googleUser.hasGrantedScopes('https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic');
          setHasPerms(hasPerms);
          
          // check if we just signed in - if so, switch to step2 and create loading screen
          if(window.location.href.endsWith('?signedin')) {
            window.history.pushState(null, document.title, '/signin')
            if(hasPerms) {
              navigateAway();
            }
          }
        });
    });
  }, []);


  // executed when user clicks sign in button
  const signIn = () => {
    gapi.auth2.getAuthInstance().signIn({ 
      prompt: 'select_account', 
      ux_mode: 'redirect',
      redirect_uri: new URL('signin?signedin', window.location.origin).toString()
    });
  };

  
  const navigateAway = () => {
    gapi.client.gmail.users.labels.list({
      userId: 'me'
    })
      .then(({ result: { labels: labels } }) => {
        if(labels?.map(label => label!.name!.startsWith('Modified by College Spam Guard')).includes(true)) {
          // modified before, redirect to manage
          navigate('/manage');
          return; // stop execution of useEffect on now unmounted component
        }
        else {
          // fresh account, redirect to setup
          navigate('/setup');
          return; // stop execution of useEffect on now unmounted component
        }
      });
  }


  return <main>
    <Container fluid='sm' className='text-center mt-3'>
      {
        basicProfile !== undefined && !hasPerms && <Alert variant='danger' className='text-start' dismissible>
          <Alert.Heading>
            Insufficient permissions
          </Alert.Heading>
          We don't have all the permissions required for this website to function. Please sign in again and check the boxes to grant us our required permissions.
        </Alert>
      }
      <h2 className='py-5'>Sign in to your email account</h2>
      <div className='m-auto' style={{ width: '300px' }}>
        <Button className='w-100' variant='outline-primary' onClick={signIn}>
          <FontAwesomeIcon icon={faGoogle} /> Sign in with Google
        </Button>
        {
          basicProfile !== undefined && hasPerms && <>
            <hr />
            <Button className='w-100' variant='secondary' onClick={navigateAway}>
              <img className='d-inline-block rounded-circle' style={{ width: '1.5rem', height: '1.5rem' }} src={basicProfile.getImageUrl()} referrerPolicy='no-referrer' /> Continue as {basicProfile.getName()}
            </Button>
          </>
        }
        
      </div>
    </Container>
  </main>
}

export default SignIn;