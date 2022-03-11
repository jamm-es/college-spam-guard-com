import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Footer } from './standard';
import { Home } from './pages';

import './index.scss';

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <div className='d-flex flex-column min-vh-100'>
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path='/' element={<Home />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
);
