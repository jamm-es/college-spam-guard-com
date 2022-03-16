import { Container } from 'react-bootstrap';

function Header(props: {}) {
  return <header className='bg-primary text-light text-center'>
    <Container fluid='sm' className='w-auto py-2'>
      <h3 className='mb-0'>College Spam Guard</h3>
    </Container>
  </header>
}

export default Header;