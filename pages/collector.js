import Head from 'next/head';
import { useEffect } from 'react';
import fs from 'fs';
import path from 'path';

export default function Collector({ htmlContent }) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/js/collector.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch(e){} };
  }, []);

  return (
    <>
      <Head>
        <title>Collector Dashboard</title>
      </Head>
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
    </>
  );
}

export async function getServerSideProps() {
  const filePath = path.join(process.cwd(), 'public', 'collector.html');
  const fullHtml = fs.readFileSync(filePath, 'utf8');
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let htmlContent = bodyMatch ? bodyMatch[1] : '';
  htmlContent = htmlContent.replace(/<script[^>]*src="\/js\/collector\.js"[^>]*><\/script>/gi, '');
  return { props: { htmlContent } };
}
