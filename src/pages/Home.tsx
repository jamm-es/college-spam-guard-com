import { Button, Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function Home(props: {}) {
  return <main className='text-center'>
    <div className='bg-primary'>
      <Container fluid='sm' className='py-5 text-light'>
        <h1 className='mb-4'>
          Clean out your inbox with College Spam Guard
        </h1>
        <Link to='/signin'>
          <Button variant='outline-light' size='lg'>
            Get started
          </Button>
        </Link>
      </Container>
    </div>
    <Container fluid='sm' className='py-5 text-start' style={{ maxWidth: '700px' }}>
      <p>
        For students with gmail accounts, College Spam Guard will scan your last 500 college spam messages for 
        email addresses to block, then apply any action you specify to remove spam currently in your inbox and prevent
        spam from accumulating in the future.
      </p>
      <p>
        You have 100% control over what emails are blocked. If you want to remove the filters in the future,
        simply log into your account, and in one click, all of College Spam Guard's actions will be completely
        undone.
      </p>
      <p>
        Your personal information doesn't leave your computer. We don't collect, transfer, or store ANY private information.
      </p>
      <br />
      <br />
      <p className='text-center'>
        Already have an account? <Link to='/signin'>Sign in</Link>
      </p>
    </Container>
  </main>
}

export default Home;