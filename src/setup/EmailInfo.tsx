import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardCheck, faBan } from '@fortawesome/free-solid-svg-icons';
import { Card, Col } from "react-bootstrap";

import Email from './Email';

function EmailInfo(props: { email: Email, variant: 'whitelist' | 'block', onIconClick?: () => void, button?: boolean }) {
  return <Col>
    <Card body className='w-100'>
      <div className='d-flex justify-content-between'>
        <h5>{props.email.school ?? props.email.name}</h5>
        {
          (props.button === undefined || props.button) && <div onClick={props.onIconClick} style={{ cursor: 'pointer', fontSize: '1.5rem' }} className={`ms-3 d-flex flex-column ${props.variant === 'whitelist' ? 'text-primary' : 'text-danger'}`}>
          <FontAwesomeIcon icon={props.variant === 'whitelist' ? faClipboardCheck : faBan}/>
        </div>
        }
        
      </div>
      <p>
        {
          props.email.name !== props.email.school && props.email.school // show props.email.name only if it's not the same as the school name and it isn't the heading
          ? <>{props.email.name} <span className='text-muted'>&lt;{props.email.emailAddress}&gt;</span></>
          : <span className='text-muted'>{props.email.emailAddress}</span>
        }
      </p>
    </Card>
  </Col>
}

export default EmailInfo;