import { Container } from "react-bootstrap";
import { Helmet } from 'react-helmet';

function PrivacyPolicy(props: {}) {
  return <main>
    <Helmet>
      <title>Privacy Policy</title>
    </Helmet>
    <h2 className='mt-4 text-center'>
      Privacy Policy
    </h2>
    <Container fluid='sm' className='text-start' style={{ maxWidth: '700px' }}>
      <p>
        College Spam Guard uses your email messages and filter settings in order to detect college spam and create filters that block them
        from your inbox.
      </p>
      <p>
        All of this data stays in your browser tab. None of it is transmitted to our servers, or anyone else's servers, after the data is loaded
        onto your browser. We don't store any cookies at all.
      </p>
      <p>
        The only data we report to our server is the web URLs of certain colleges who've emailed you that aren't in our database yet. This little
        bit of data is itself stripped down before it's sent to our server, and is used only so that we can correctly group messages from the same
        school together. 
        No personally identifying information is included at all.
      </p>
    </Container>
  </main>
}

export default PrivacyPolicy;