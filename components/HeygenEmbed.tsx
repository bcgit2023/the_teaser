'use client'

import { useEffect } from 'react'

export default function HeygenEmbed() {
  useEffect(() => {
    // Create script element
    const script = document.createElement('script')
    script.innerHTML = `
      !function(window){
        const host="https://labs.heygen.com",
        url=host+"/guest/streaming-embed?share=eyJxdWFsaXR5IjoiaGlnaCIsImF2YXRhck5hbWUiOiJXYXluZV8yMDI0MDcxMSIsInByZXZpZXdJbWciOiJodHRwczovL2ZpbGVzMi5oZXlnZW4uYWkvYXZhdGFyL3YzL2EzZmRiMGM2NTIwMjRmNzk5ODRhYWVjMTFlYmYyNjk0XzM0MzUwL3ByZXZpZXdfdGFyZ2V0LndlYnAiLCJuZWVkUmVtb3ZlQmFjYWRnZCI6ZmFsc2UsImtub3dsZWRnZUJhc2VJZCI6Ijk4ZTUwMDMzYjczZjQ1YWFiYTVhNTE1Y2ZkNmJhMmM1IiwidXNlcm5hbWUiOiI3ZjcwZTc3MTU1MDU0YzlkYmY0ZmMxOWFhN2M2ZTVjNyJ9&inIFrame=1",
        clientWidth=document.body.clientWidth,
        wrapDiv=document.createElement("div");
        wrapDiv.id="heygen-streaming-embed";
        
        const container=document.createElement("div");
        container.id="heygen-streaming-container";
        
        const stylesheet=document.createElement("style");
        stylesheet.innerHTML=\`
          #heygen-streaming-embed {
            z-index: 9999;
            position: fixed;
            right: 20px;
            bottom: 100px;
            width: 180px;
            height: 180px;
            border-radius: 50%;
            border: 2px solid #fff;
            box-shadow: 0px 8px 24px 0px rgba(0, 0, 0, 0.12);
            transition: all linear 0.1s;
            overflow: hidden;
            opacity: 1;
            visibility: visible;
            cursor: pointer;
          }
          
          #heygen-streaming-embed.expand {
            \${clientWidth<540?
              "width: 100%; height: 100%; right: 0; bottom: 0; border-radius: 0;":
              "width: 360px; height: 640px; right: 20px; bottom: 20px; border-radius: 12px;"
            }
          }
          
          #heygen-streaming-container {
            width: 100%;
            height: 100%;
          }
          
          #heygen-streaming-container iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
        \`;
        
        document.head.appendChild(stylesheet);
        document.body.appendChild(wrapDiv);
        wrapDiv.appendChild(container);
        
        const iframe=document.createElement("iframe");
        iframe.src=url;
        iframe.allow="camera; microphone; clipboard-write";
        container.appendChild(iframe);
        
        let isExpanded=false;
        wrapDiv.addEventListener("click",function(){
          isExpanded=!isExpanded;
          wrapDiv.classList.toggle("expand",isExpanded);
        });
      }(window);
    `
    document.body.appendChild(script)

    return () => {
      // Cleanup
      const embedDiv = document.getElementById('heygen-streaming-embed')
      const styleSheet = document.querySelector('style')
      if (embedDiv) {
        document.body.removeChild(embedDiv)
      }
      if (styleSheet) {
        document.head.removeChild(styleSheet)
      }
      document.body.removeChild(script)
    }
  }, [])

  return null
}
