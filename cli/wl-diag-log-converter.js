const moment=require("moment");
const fs=require('fs');
const readline=require('readline');

const DEFAULTS=
{
  start: "(\\[\\d{4,4}-\\d{2,2}-\\d{2,2}T.*\\] )", 
  record: "(\\[\\d{4,4}-\\d{2,2}-\\d{2,2}T.*\\] )(\\[.*\\] )+(((.*)\\[\\[(.|\n)*\\]\\]\n)|(([^\\[]*)\n))",
  tsformat: "YYYY-MM-DDThh:mm:ss.SSSZ"
}

let Converter=function(options)
{
  this.options=options;
  this.dataBuffer="";
};

Converter.prototype.process=async function()
{
  let converter=this;
  converter.recordStartMarker=new RegExp(converter.options.recordStartMarker || DEFAULTS.start);
  converter.multiLine=false;
  let fstream=fs.createReadStream(converter.options.file);
  let rl=readline.createInterface({
    input: fstream,
    crlfDelay: Infinity
  });

  for await (let line of rl)
  {
    converter.handleLineFromFile(line);
  }
}

Converter.prototype.handleLineFromFile=function(line)
{
  let converter=this;
  if(!converter.multiLine)
  {
    let startMatch=line.match(converter.recordStartMarker);
    if(startMatch!=null && startMatch.index==0)
    {
      if(converter.dataBuffer!="") console.error("Unparsed data: ", converter.dataBuffer);
      converter.dataBuffer=line + "\n";
      if(line.endsWith("[[")) converter.multiLine=true;
      else converter.processDataBuffer(false);
    }
  }
  else
  {
    converter.dataBuffer += line + "\n";
    if(line.endsWith("]]"))
    {
      converter.multiLine=false;
      converter.processDataBuffer(true);
    }
  }

}

Converter.prototype.processDataBuffer=function(multiLine)
{
  let converter=this;
  converter.handleLogRecord(converter.dataBuffer, multiLine);
  converter.dataBuffer="";
}

Converter.prototype.handleLogRecord=function(recordLine, multiLine)
{
  let converter=this;
  let logRecord=logRecordSplitter(recordLine, converter.options, multiLine);
  logRecord.type=converter.options.type;
  logRecord.source=converter.options.name;
  console.log(JSON.stringify(logRecord));
}

let logRecordSplitter=(recordLine, options, multiLine)=>
{
  let tsformat=options.tsformat || DEFAULTS.tsformat;
  let multiLineMessage="";
  let firstLine=recordLine;

  if(multiLine)
  {
    let l=recordLine.split("\n");
    l.pop();
    l.pop();
    l[0]=l[0].substr(0, l[0].length-2);
    firstLine=l.shift();
    multiLineMessage=l.join("\n");
  }
  else firstLine=recordLine.substr(0, recordLine.length-1);

  let fields=firstLine.split("] [");

  let logRecord={};
  logRecord.ts=fields.shift().substr(1);
  logRecord.server= fields.shift();
  logRecord.level= fields.shift();

  fields.shift();
  logRecord.logger= fields.shift();
  
  let lastField=fields.pop();
  let index=lastField.indexOf("]");
  logRecord.message=lastField.substr(index+2) + multiLineMessage;
  fields.push(lastField.substr(0, index));

  logRecord=fields.reduce((a,c)=>
  {
    let index=c.indexOf(":");
    if(index!=-1) a[c.substring(0, index)]=c.substring(index+2);
    return a;
  }, logRecord)

  logRecord.ts=moment(logRecord.ts, tsformat).toISOString();
  return logRecord;
}

module.exports=Converter