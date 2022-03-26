import { useEffect, useState } from "react";

function LoadingText(props: { loadingMessage: String, extraMessage: String | undefined}) {

  const [numDots, setNumDots] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setNumDots(numDots => (numDots+1) % 5);
    }, 500);

    return () => clearInterval(interval);
  }, [])

  return <>
    <p>{props.loadingMessage} {'.'.repeat(numDots)}</p>
    {props.extraMessage && <p>
      {props.extraMessage}
    </p>}
  </>
}

export default LoadingText;