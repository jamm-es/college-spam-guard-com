import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { Header, Footer, NotFound } from './standard';
import { Home } from './pages';
import { Setup } from './setup';
import { Manage } from './manage';
import { SignIn } from './signin';
import { Admin } from './admin';

import './index.scss';

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <div className='d-flex flex-column min-vh-100'>
        <Routes>
          <Route path='/' />
          <Route path='*' element={<Header />} />
        </Routes>
        <div className='position-relative' style={{ flex: 1 }}>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/signin' element={<SignIn />}/>
            <Route path='/setup' element={<Setup />} />
            <Route path='/manage' element={<Manage />} />
            <Route path='/admin' element={<Admin />} />
            <Route path='*' element={<NotFound />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
);
