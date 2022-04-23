import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function Footer(props: {}) {
  return <footer className='bg-dark text-light text-center'>
    <Container fluid='sm' className='w-auto py-3'>
      <p>CollegeSpamGuard &copy; 2022</p>
      <p>
        <Link to='/' className='text-light'>Home</Link> | <Link to='/' className='text-light'>Sign In</Link> | <Link to='/privacy-policy' className='text-light'>Privacy Policy</Link>
      </p>
      <p className='mb-0'>Contact: <Link to='mailto:me@jamm.es' className='text-light'>me@jamm.es</Link></p>
    </Container>
  </footer>
}

export default Footer;