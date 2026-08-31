"use client";

import { useMemo,useState,type FormEvent } from "react";
import Link from "next/link";
import { formatArs } from "@/lib/auction/format";
import type { ContactRecord } from "@/lib/auction/types";

export function AdminReservations(){
  const[token,setToken]=useState("");const[contacts,setContacts]=useState<ContactRecord[]>([]);const[query,setQuery]=useState("");const[error,setError]=useState<string|null>(null);const[loading,setLoading]=useState(false);const[authenticated,setAuthenticated]=useState(false);
  const filtered=useMemo(()=>{const value=query.trim().toLowerCase();return value?contacts.filter(item=>[item.company,item.email,item.placement].some(field=>field.toLowerCase().includes(value))):contacts;},[contacts,query]);
  const reservations=contacts.filter(item=>item.bidStatus==="RESERVED"||item.bidStatus==="CONTACTED");

  async function load(event?:FormEvent){event?.preventDefault();setLoading(true);setError(null);const response=await fetch("/api/admin/reservations",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const body=await response.json() as {contacts?:ContactRecord[];error?:string};setLoading(false);if(!response.ok){setAuthenticated(false);setError(body.error??"No pudimos abrir el panel.");return;}setContacts(body.contacts??[]);setAuthenticated(true);}
  async function contact(bidId:string){const response=await fetch("/api/admin/reservations",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({bidId})});if(response.ok)await load();}
  function exportCsv(){const header=["estado","lugar","empresa","email","oferta_ars","ranking","creada","contactada"];const rows=filtered.map(item=>[item.bidStatus,item.placement,item.company,item.email,item.amountCents/100,item.rank??"",item.createdAt,item.contactedAt??""]);const csv=[header,...rows].map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(",")).join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download=`reservas-startup-day-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);}

  if(!authenticated)return <main className="admin-page"><section className="admin-login"><Link href="/" className="brand">Startup Day <sup>2026</sup></Link><p className="eyebrow">Panel privado</p><h1>Reservas y contactos</h1><p>Ingresá el token de administración configurado en el servidor. No se guarda en el navegador.</p><form onSubmit={load}><label className="field"><span>Token de administración</span><input type="password" value={token} onChange={event=>setToken(event.target.value)} autoComplete="off" required/></label>{error&&<p className="form-error">{error}</p>}<button className="button button--dark" disabled={loading}>{loading?"Verificando…":"Abrir panel"}</button></form></section></main>;

  return <main className="admin-page"><header className="admin-header"><div><Link href="/" className="brand">Startup Day <sup>2026</sup></Link><p className="eyebrow">Gestión manual</p><h1>Reservas y emails</h1></div><button className="button button--dark" onClick={exportCsv}>Exportar CSV</button></header>
    <section className="admin-metrics"><div><strong>{contacts.length}</strong><span>Emails guardados</span></div><div><strong>{reservations.length}</strong><span>Reservas ganadoras</span></div><div><strong>{reservations.filter(item=>!item.contactedAt).length}</strong><span>Pendientes de contactar</span></div></section>
    <section className="admin-contacts"><div className="admin-toolbar"><label className="field"><span>Buscar</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Empresa, email o lugar"/></label><button className="button" onClick={()=>void load()}>Actualizar</button></div>
      <div className="contact-table"><div className="contact-row contact-row--head"><span>Estado</span><span>Empresa / email</span><span>Lugar</span><span>Oferta</span><span>Acciones</span></div>{filtered.map(item=><article className="contact-row" key={item.bidId}><span><b className={`contact-status contact-status--${item.bidStatus.toLowerCase()}`}>{statusLabel(item.bidStatus)}</b>{item.rank&&<small>Ranking #{item.rank}</small>}</span><span><strong>{item.company}</strong><a href={`mailto:${item.email}`}>{item.email}</a></span><span>{item.placement}</span><strong>{formatArs(item.amountCents)}</strong><span className="contact-actions"><a className="button" href={mailTo(item)}>Redactar mail</a>{!item.contactedAt&&<button className="button" onClick={()=>void contact(item.bidId)}>Marcar contactado</button>}</span></article>)}</div>
      {!filtered.length&&<div className="my-bids-empty"><strong>No hay contactos para mostrar.</strong><span>Los emails se guardan cuando alguien confirma una oferta.</span></div>}
    </section></main>;
}

function statusLabel(status:ContactRecord["bidStatus"]){return{LEADING:"Liderando",OUTBID:"Superada",RESERVED:"Reservada",CONTACTED:"Contactada",FAILED:"Fallida"}[status];}
function mailTo(item:ContactRecord){const subject=encodeURIComponent(`Startup Day · ${item.placement}`);const body=encodeURIComponent(`Hola ${item.company},\n\nTu oferta de ${formatArs(item.amountCents)} por ${item.placement} quedó reservada.\n\n`);return`mailto:${item.email}?subject=${subject}&body=${body}`;}
