import {GET,POST} from '../app/api/daily/route';
export default {fetch:(r:Request)=>r.method==='POST'?POST(r):GET()};
