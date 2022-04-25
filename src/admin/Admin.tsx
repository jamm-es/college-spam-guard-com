import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Button, Container, Form } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

function Admin(props: {}) {

  const [password, setPassword] = useState<string>('');
  const [collegeURLs, setCollegeURLs] = useState([]);
  const [unknownSchools, setUnknownSchools] = useState([]);
  const [whitelistedEmails, setWhitelistedEmails] = useState([]);
  const [message, setMessage] = useState<string>('No message');
  const [searchParams, setSearchParams] = useSearchParams();
  const whitelistedEmailDomain = useRef<HTMLInputElement>(null);
  const whitelistedEmailFullEmail = useRef<HTMLInputElement>(null);
  const whitelistedEmailRegex = useRef<HTMLInputElement>(null);
  const collegeURLURL = useRef<HTMLInputElement>(null);
  const collegeURLName = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const password = searchParams.get('password');

    // password isn't there
    if(password === null) {
      navigate('/');
      return;
    }
    setPassword(password);

    // do API request - if 401, navigate away
    axios.get(new URL('admin', process.env.REACT_APP_API_URL).href, {
      headers: {
        'Authorization': `Basic ${password}`
      }
    })
      .then(res => {
        setUnknownSchools(res.data.sort((a: any, b: any) => a.count > b.count ? -1 : 1));

        axios.get(new URL('college-urls', process.env.REACT_APP_API_URL).href)
          .then(res => {
            setCollegeURLs(res.data);

            axios.get(new URL('whitelisted-emails', process.env.REACT_APP_API_URL).href)
              .then(res => {
                setWhitelistedEmails(res.data);
              });
          });
      })
      .catch(err => {
        if(err.response.status === 401) {
          navigate('/');
          return;
        }
      })
  }, [message]);


  const addWhitelistedEmail = () => {
    const payload: {[key: string]: string} = {};
    if(whitelistedEmailDomain.current !== null && whitelistedEmailDomain.current.value !== '') {
      payload.domain = whitelistedEmailDomain.current.value;
    }
    if(whitelistedEmailFullEmail.current !== null && whitelistedEmailFullEmail.current.value !== '') {
      payload.fullEmail = whitelistedEmailFullEmail.current.value;
    }
    if(whitelistedEmailRegex.current !== null && whitelistedEmailRegex.current.value !== '') {
      payload.regex = whitelistedEmailRegex.current.value;
    }
    axios.post(new URL('whitelisted-emails', process.env.REACT_APP_API_URL).href, payload, {
      headers: {
        'Authorization': `Basic ${password}`
      }
    })
      .then(() => {
        setMessage(`set\n${JSON.stringify(payload, null, '\t')}`);

        // clear the fields
        if(whitelistedEmailDomain.current !== null) {
          whitelistedEmailDomain.current.value = '';
        }
        if(whitelistedEmailFullEmail.current !== null) {
          whitelistedEmailFullEmail.current.value = '';
        }
        if(whitelistedEmailRegex.current !== null) {
          whitelistedEmailRegex.current.value = '';
        }
      })
      .catch(err => {
        setMessage(err);
      })
  }


  const addCollegeURL = () => {
    const payload: {[key: string]: string | boolean} = {};
    if(collegeURLURL.current === null || collegeURLURL.current.value === '' || collegeURLName.current === null || collegeURLName.current.value === '') {
      setMessage('Incomplete college URL form');
      return;
    }
    payload.url = collegeURLURL.current.value;
    payload.isEdu = collegeURLURL.current.value.endsWith('.edu');
    payload.name = collegeURLName.current.value;
    axios.post(new URL('college-urls', process.env.REACT_APP_API_URL).href, payload, {
      headers: {
        'Authorization': `Basic ${password}`
      }
    })
      .then(() => {
        if(collegeURLURL.current !== null) {
          collegeURLURL.current.value = '';
        }
        if(collegeURLName.current !== null) {
          collegeURLName.current.value = '';
        }
        setMessage(`set\n${JSON.stringify(payload, null, '\t')}`);
      })
      .catch(err => {
        setMessage(err);
      })
  }


  return <main id='top'>
    <Helmet>
      <title>Admin</title>
    </Helmet>
    <div className='position-fixed end-0 top-50 w-50 bg-dark text-light'>
      <code>
      <u><a href='#top' className='text-light'>go to top</a></u>
      </code>
      <br />
      <code style={{ whiteSpace: 'pre' }} className='text-light'>{message}</code>
    </div>
    <Container fluid='sm'>
      <h1>Admin Panel</h1>
      <h4>Add whitelisted email</h4>
      <Form className='mb-5'>
        <Form.Group className='mb-3'>
          <Form.Label>
            Domain (ie, xyz.edu)
          </Form.Label>
          <Form.Control type='text' ref={whitelistedEmailDomain} />
        </Form.Group>
        <Form.Group className='mb-3'>
          <Form.Label>
            Full Email (ie, abc@xyz.edu)
          </Form.Label>
          <Form.Control type='text' ref={whitelistedEmailFullEmail} />
        </Form.Group>
        <Form.Group className='mb-3'>
          <Form.Label>
            Regex
          </Form.Label>
          <Form.Control type='text' ref={whitelistedEmailRegex} />
        </Form.Group>
        <Button onClick={addWhitelistedEmail}>
          Submit
        </Button>
      </Form>
      <h4>Add college URL</h4>
      <Form className='mb-5'>
        <Form.Group className='mb-3'>
          <Form.Label>
            URL (ie, xyz.edu)
          </Form.Label>
          <Form.Control type='text' ref={collegeURLURL} />
        </Form.Group>
        <Form.Group className='mb-3'>
          <Form.Label>
            Name
          </Form.Label>
          <Form.Control type='text' ref={collegeURLName} />
        </Form.Group>
        <Button onClick={addCollegeURL}>
          Submit
        </Button>
      </Form>
      <h4>Unknown Schools</h4>
      <code style={{ whiteSpace: 'pre' }}>
        {JSON.stringify(unknownSchools, null, '\t')}
      </code>
      <h4>Whitelisted Emails</h4>
      <code style={{ whiteSpace: 'pre' }}>
        {JSON.stringify(whitelistedEmails, null, '\t')}
      </code>
      <h4>College URLs</h4>
      <code style={{ whiteSpace: 'pre' }}>
        {JSON.stringify(collegeURLs, null, '\t')}
      </code>
    </Container>
  </main>
}

export default Admin;