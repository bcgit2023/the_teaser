'use client'

import { useEffect, useState } from 'react'

export default function HeygenEmbed() {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (!isEnabled) {
      const embed = document.getElementById('heygen-streaming-embed');
      if (embed) {
        document.body.removeChild(embed);
      }
      return;
    }

    const script = document.createElement('script')
    script.innerHTML = `!function(window){
      const host="https://labs.heygen.com",
      url=host+"/guest/streaming-embed?share=eyJxdWFsaXR5IjoiaGlnaCIsImF2YXRhck5hbWUiOiJmYTdiMzRmZTBiMjk0ZjAyYjJmY2E2YzFlZDJjNzE1OCIsInByZXZpZXdJbWciOiJodHRwczovL2ZpbGVzMi5oZXlnZW4uYWkvYXZhdGFyL3YzL2ZhN2IzNGZlMGIyOTRmMDJiMmZjYTZjMWVkMmM3MTU4L2Z1bGwvMi4yL3ByZXZpZXdfdGFyZ2V0LndlYnAiLCJuZWVkUmVtb3ZlQmFja2dyb3VuZCI6ZmFsc2UsImtub3dsZWRnZUJhc2VJZCI6IjVkMGFkOTIyOTUxMTQwNDliZmJmNGEzZTBlYjFkNmQwIiwidXNlcm5hbWUiOiIwNjdiODdkZGYzNTY0ZGFiYTRlNTBiM2RkNzNiNTUwNCJ9&inIFrame=1",
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
          right: 85px;
          bottom: 80px;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0px 8px 24px 0px rgba(0, 0, 0, 0.12);
          transition: all linear 0.1s;
          overflow: hidden;
          opacity: 0;
          visibility: hidden;
          cursor: pointer;
        }
        #heygen-streaming-embed.show {
          opacity: 1;
          visibility: visible;
        }
        #heygen-streaming-embed.expand {
          \${clientWidth<540?"height: 266px; width: 256px; right: 85px;":"height: 300px; width: 256px;"}
          border: 0;
          border-radius: 8px;
        }
        #heygen-streaming-container {
          width: 100%;
          height: 100%;
        }
        #heygen-streaming-container iframe {
          width: 100%;
          height: 100%;
          border: 0;
        }
      \`;
      
      const iframe=document.createElement("iframe");
      iframe.allowFullscreen=false;
      iframe.title="Streaming Embed";
      iframe.role="dialog";
      iframe.allow="microphone";
      iframe.src=url;
      
      let visible=false,
          initial=false;
          
      window.addEventListener("message",(e=>{
        if(e.origin===host && e.data && e.data.type==="streaming-embed") {
          console.log("Received message:", e.data);
          if(e.data.action==="init") {
            initial=true;
            wrapDiv.classList.toggle("show",initial);
          } else if(e.data.action==="show") {
            visible=true;
            wrapDiv.classList.toggle("expand",visible);
          } else if(e.data.action==="hide") {
            visible=false;
            wrapDiv.classList.toggle("expand",visible);
          }
        }
      }));
      
      // Handle click to expand/collapse
      wrapDiv.addEventListener("click", function() {
        if (!this.classList.contains("expand")) {
          this.classList.add("expand");
        } else {
          this.classList.remove("expand");
        }
      });
      
      container.appendChild(iframe);
      wrapDiv.appendChild(stylesheet);
      wrapDiv.appendChild(container);
      document.body.appendChild(wrapDiv);
    }(window);`

    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
      const embed = document.getElementById('heygen-streaming-embed')
      if (embed) {
        document.body.removeChild(embed)
      }
    }
  }, [isEnabled])

  return (
    <div className="fixed top-4 right-4 flex items-center gap-2 z-[10000] bg-white/80 backdrop-blur-sm py-2 px-4 rounded-lg shadow-md">
      <span className="font-medium text-[#0066CC]">FL V3</span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={isEnabled}
          onChange={(e) => setIsEnabled(e.target.checked)}
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0066CC]"></div>
      </label>
    </div>
  )
}
