import { Container } from 'react-bootstrap';

function Footer(props: {}) {
  return <footer className='bg-dark text-light text-center'>
    <Container fluid='sm' className='w-auto py-3'>
      <p className='mb-0'>CollegeSpamGuard &copy; 2022</p>
    </Container>
  </footer>
}

export default Footer;