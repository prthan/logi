const logger=require("../../logger");
let handler={}

handler.message="disconnect";
handler.process=(socket, socmsg, agent)=>
{
  let socid=socket.id;
  logger.info(`client ${socid} disconnected`);
  delete agent["@sockets"][socid];
}

module.exports=handler;