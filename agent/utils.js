var utils = {}

utils.shortid=function()
{
  let rval=[];
  let a=Array.from(Math.random().toString(36).substr(2,9));
  let b=Array.from(new Date().getTime().toString(36));
  a.forEach((x,i)=>
  {
    rval.push(x);
    if(i<b.length)
    {
      rval.push(b.shift());
    }
  });
  if(b.length!=0) rval=rval.concat(b);
  return rval.join("");
}

String.prototype.toCamelCase=function()
{
  var rval='';
  var cc=false;
  var str=this;
  
  for(var i=0,l=str.length;i<l;i++)
  {
    var char=str.charAt(i);
    if(char == '_')
    {
      cc=true;
      continue;
    }
    if(cc)
    {
      rval += char.toUpperCase();
      cc=false;
    }
    else rval += char.toLocaleLowerCase();
  }
  return rval;
};

String.prototype.toInitCase=function()
{
  var str=this;
  return this.substring(0,1).toUpperCase()+this.substring(1);
};

utils.err2obj=(err, includeTrace)=>
{
  var obj=
  {
    code: err.code,
    message: err.message
  };
  if(includeTrace) obj.trace=err.stack;
  var ein=err;
  var eout=obj;
  while(ein.source)
  {
    var source={code: ein.source.code, message: ein.source.message};
    if(includeTrace) source.trace=ein.source.stack;
    eout.source=source;
    ein=ein.source;
    eout=eout.source;
  }
  return obj;
}

utils.wrapText=(text, size, limit)=>
{
  let lines=[];
  let index=0;
  let length=text.length;
  if(!limit) limit=length
  while(index<length && index<limit)
  {
    lines.push(text.substr(index, size).padEnd(size, " "));
    index+=size;
  }

  return lines;
}

utils.debounce=(fn, delay)=>
{
  let scope=this;
  let dfn=function()
  {
    let args=arguments;
    if(fn.timerId!=-1) clearTimeout(fn.timerId);
    fn.timerId=setTimeout(()=>fn.apply(scope, args), delay);
  }
  return dfn;
}

module.exports=utils;
