const logger=require("../../logger");
let handler={}

handler.message="/logi/announce";
handler.process=(socket, socmsg)=>
{
  let config=global.config;
  logger.info(`client ${socmsg.oid} connected`);
  socket.emit('/logi/announce/ack', {status: 'ok', sources: config["file-sources"]});
}

module.exports=handler;