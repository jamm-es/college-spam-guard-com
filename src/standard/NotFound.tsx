import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function NotFound(props: {}) {
  const navigate = useNavigate();


  useEffect(() => {
    navigate('/', { replace: true });
    return;
  }, []);
  

  return <main>
    <h1 className='text-center'>Page not found</h1>
  </main>
}

export default NotFound;