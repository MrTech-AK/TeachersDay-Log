const fs = require('fs');

function convertHtmlToJsx(htmlPath, jsPath, pageName, cssPath) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    // Extract body content
    const bodyMatch = html.match(/<body>([\s\S]*?)<script/);
    if (!bodyMatch) return;
    
    let bodyContent = bodyMatch[1];
    
    // Quick JSX conversions
    bodyContent = bodyContent.replace(/class=/g, 'className=');
    bodyContent = bodyContent.replace(/for=/g, 'htmlFor=');
    bodyContent = bodyContent.replace(/style="([^"]*)"/g, (match, styles) => {
        const reactStyles = styles.split(';').filter(s => s.trim()).reduce((acc, style) => {
            const [key, value] = style.split(':');
            const camelKey = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
            acc[camelKey] = value.trim();
            return acc;
        }, {});
        return `style={${JSON.stringify(reactStyles)}}`;
    });
    // Fix standalone inputs/br
    bodyContent = bodyContent.replace(/<input([^>]*[^\/])>/g, '<input$1 />');
    bodyContent = bodyContent.replace(/<br>/g, '<br />');

    const template = `
import Head from 'next/head';
import { useEffect } from 'react';

export default function ${pageName}() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${jsPath}';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      try { document.body.removeChild(script); } catch(e){}
    };
  }, []);

  return (
    <>
      <Head>
        <title>${pageName} Dashboard</title>
        <link rel="stylesheet" href="${cssPath}" />
      </Head>
      <div dangerouslySetInnerHTML={{ __html: \`${bodyContent.replace(/`/g, '\\`')}\` }} />
    </>
  );
}
`;

    fs.writeFileSync(`pages/${pageName.toLowerCase()}.js`, template);
}

convertHtmlToJsx('public/admin.html', '/js/admin.js', 'Admin', '/css/admin.css');
convertHtmlToJsx('public/collector.html', '/js/collector.js', 'Collector', '/css/collector.css');

