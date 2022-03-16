import { Button, Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function Home(props: {}) {
  return <main className='bg-primary text-light text-center'>
    <Container fluid='sm' className='py-5'>
      <h1 className='mb-4'>Instantly block all college spam</h1>
      <Link to='/setup'>
        <Button variant='outline-light' size='lg'>
          Get started
        </Button>
      </Link>
    </Container>
  </main>
}

export default Home;