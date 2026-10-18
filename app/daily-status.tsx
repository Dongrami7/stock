'use client';
import {useEffect,useState} from 'react';
export default function DailyStatus(){const [data,setData]=useState<any>(null);useEffect(()=>{fetch('/api/daily').then(r=>r.ok?r.json():null).then(setData).catch(()=>{});},[]);if(!data?.lastSuccess)return null;return <div className="notice" style={{margin:'12px 0'}}>일일 수집 저장: {new Date(data.lastSuccess).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})} · 공개 시세 기준일 {data.quoteAsOf||'미확인'} · 삼성전자·SK하이닉스 정기 재무/공시 수집 · 원본 전망치는 별도 업로드 기준</div>}
