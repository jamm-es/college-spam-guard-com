import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardCheck, faBan, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { Card, Col, ListGroup, ListGroupItem } from "react-bootstrap";
import { useState } from 'react';

import Email from './Email';
import EmailGroup from './EmailGroup';

function EmailInfo(props: { emailGroup: EmailGroup, variant: 'whitelist' | 'block', onIconClick?: (email?: Email) => void, button?: boolean }) {

  const [showList, setShowList] = useState<boolean>(false);


  const generateEmailText = (email: Email) => email.name !== email.school && email.school // show email.name only if it's not the same as the school name and it isn't the heading
  ? <>{email.name} <span className='text-muted'>&lt;{email.emailAddress}&gt;</span></>
  : <span className='text-muted'>{email.emailAddress}</span>


  return <Col>
    <Card className='w-100'>
      <Card.Body>
        <div className='d-flex justify-content-between'>
          <h5 className={props.emailGroup.emails.length > 1 ? 'mb-0' : ''} style={{ minWidth: 0 }}>{props.emailGroup.school}</h5>
          {
            (props.button === undefined || props.button) && <div onClick={() => props.onIconClick!()} style={{ cursor: 'pointer', fontSize: '1.5rem' }} className={`ms-3 d-flex flex-column ${props.variant === 'whitelist' ? 'text-primary' : 'text-danger'}`}>
            <FontAwesomeIcon icon={props.variant === 'whitelist' ? faClipboardCheck : faBan}/>
          </div>
          }
        </div>
        {props.emailGroup.emails.length === 1 && <p className='mb-0' style={{ minWidth: 0 }}>{generateEmailText(props.emailGroup.emails[0])}</p>}
      </Card.Body>
      {props.emailGroup.emails.length > 1 && <>
        {showList && <ListGroup variant='flush'>
          {props.emailGroup.emails.map(email => <ListGroupItem key={email.emailAddress} className='d-flex justify-content-between' style={{ minWidth: 0 }}>
            <p className='mb-0' style={{ minWidth: 0 }}>
              {generateEmailText(email)}
            </p>
            {(props.button === undefined || props.button) && <div onClick={() => props.onIconClick!(email)} style={{ cursor: 'pointer', fontSize: '1.5rem' }} className={`ms-3 d-flex flex-column text-muted`}>
              <FontAwesomeIcon icon={props.variant === 'whitelist' ? faClipboardCheck : faBan}/>
            </div>}
          </ListGroupItem>)}
        </ListGroup>}
        <Card.Footer onClick={() => setShowList(showListState => !showListState)} style={{ cursor: 'pointer' }}>
          <FontAwesomeIcon icon={showList ? faChevronUp : faChevronDown} className='me-3' />
          {showList ? 'Collapse emails' : `Show ${props.emailGroup.emails.length} emails`}
        </Card.Footer>
      </>}
    </Card>
  </Col>
}

export default EmailInfo;