(function(window)
{
  let __package = "logi.io";
  let __name = "ReadLineInterface";

  class ReadLineInterface
  {
    constructor(file)
    {
      this.file=file;
      this.fileSize=file.size;
      this.chunkSize=1024 * 8;
      this.buffer="";
      this.currentPart=0;
      this.totalParts=Math.floor(this.fileSize / this.chunkSize);
      this.lastPartSize=this.fileSize % this.chunkSize;
      if(this.lastPartSize>0) this.totalParts ++;
    
      this.currentLine=0;
    
    }

    readChunk()
    {
      let rli=this;
      let impl=async(res$, rej$)=>
      {
        if(rli.currentPart==rli.totalParts)
        {
          rli.eof=true;
          res$(null);
          return;
        }
        rli.currentPart++;
        
        let sizeToRead=rli.chunkSize;
        if(rli.currentPart==rli.totalParts) sizeToRead=rli.lastPartSize;
        let offset=(rli.currentPart-1)*rli.chunkSize;
        rli.partBlob=rli.file.slice(offset, offset + sizeToRead);
        let partBlobText=await rli.partBlob.text();
        res$(partBlobText);
        delete rli.partBlob;
      }
    
      return new Promise(impl);
    }

    readLine()
    {
      let rli=this;
      let impl=async(res$, rej$)=>
      {
        let index=rli.buffer.indexOf("\n");
        let currentPartChunk=null;
        while(index==-1)
        {
          currentPartChunk=await rli.readChunk();
          if(currentPartChunk==null) break;
    
          rli.buffer+=currentPartChunk;
          index=rli.buffer.indexOf("\n");
        }
    
        rli.currentLine++;
        if(index!=-1)
        {
          let line=rli.buffer.substr(0, index);
          rli.buffer=rli.buffer.substring(index+1);
          res$(line);
        }
        else if(index==-1 && currentPartChunk==null && rli.buffer=="") res$(null);
        else
        {
          let line=rli.buffer;
          rli.buffer="";
          res$(line);
        }
      }
    
      return new Promise(impl);
    }
    
    metrics()
    {
      let rli=this;
      let metric=
      {
        currentLine: rli.currentLine, 
        totalParts: rli.totalParts, 
        currentPart: rli.currentPart, 
        chunkSize: rli.chunkSize, 
        percent: Math.round(rli.currentPart / rli.totalParts * 100)
      }
      return metric;
    }

    async *[Symbol.asyncIterator]()
    {
      let rli=this;
      let str=await rli.readLine();
      while(str!=null)
      {
        yield str;
        str=await rli.readLine();
      }  
    }
  }
  __package.split(".").reduce((a, e) => a[e] = a[e] || {}, window)[__name] = ReadLineInterface;  
  
})(window);