import{f as Te,u as oe,J as $,y as q,P as G,o as ce}from"./mini-CE0U2Cqu.js";function Ft(){return"10000000-1000-4000-8000-100000000000".replace(/[018]/g,e=>(+e^crypto.getRandomValues(new Uint8Array(1))[0]&15>>+e/4).toString(16))}function wt({content:e,buttons:t,onCancel:r,onClose:o,type:i,placeholder:n="",width:c}){const a=Ft();function s(f){f.preventDefault(),f.stopPropagation(),r(document.getElementById(a))}function d(f){if(f.preventDefault(),f.stopPropagation(),o)return o(document.getElementById(a),document.getElementById("_in"+a).value)}function u(f,p){f.preventDefault(),f.stopPropagation(),p(document.getElementById(a),document.getElementById("_in"+a)?.value)}function l(f){f.key==="Escape"?s(f):f.key==="Enter"&&d(f)}return oe(()=>{i==="prompt"?setTimeout(()=>{document.getElementById("_in"+a)?.focus()},10):t&&setTimeout(()=>{document.getElementById("_btn"+a)?.focus()},10)}),$`<div id="${a}" aria-busy="true" class='alert' @click="${s}"><div class='alert-message' @click="${f=>f.stopPropagation()}" @keyup="${l}"><div class="msg" style="${c?"width:"+c+"px;":""}">${e} ${i==="prompt"&&`<br/><input type='text' id='_in${a}' @keyup="${l}" placeholder="${n||""}"/>`}</div><div>${t?.map((f,p)=>()=>$`<button id="${f.focus?"_btn"+a:""}" @click="${v=>u(v,f.onClick)}" tabindex="${p+1}" >${f.label}</button>`)}</div></div></div>`}async function Ct(e,t){return await new Promise((r,o)=>{const i=document.body.querySelector("div"),n=document.createElement("div");i.appendChild(n);function c(s){s.parentElement.remove(),r(!0)}function a(s){s.parentElement.remove(),r(!1)}Te(n,()=>wt({content:e,buttons:[{label:"Cancel",onClick:a},{label:"OK",onClick:c,focus:!0}],onCancel:a,type:"confirm",width:t}))})}async function se(e,t){return await new Promise((r,o)=>{const i=document.body.querySelector("div"),n=document.createElement("div");i.appendChild(n);function c(a){a.parentElement.remove(),r(!1)}Te(n,()=>wt({content:e,buttons:[{label:"OK",onClick:c,focus:!0}],onCancel:c,type:"alert",width:t}))})}var Y=Uint8Array,fe=Uint16Array,Dt=Int32Array,_t=new Y([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),kt=new Y([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),zt=new Y([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),$t=function(e,t){for(var r=new fe(31),o=0;o<31;++o)r[o]=t+=1<<e[o-1];for(var i=new Dt(r[30]),o=1;o<30;++o)for(var n=r[o];n<r[o+1];++n)i[n]=n-r[o]<<5|o;return{b:r,r:i}},St=$t(_t,2),Et=St.b,Ut=St.r;Et[28]=258,Ut[258]=28;var Gt=$t(kt,0),Ot=Gt.b,Pe=new fe(32768);for(var O=0;O<32768;++O){var re=(O&43690)>>1|(O&21845)<<1;re=(re&52428)>>2|(re&13107)<<2,re=(re&61680)>>4|(re&3855)<<4,Pe[O]=((re&65280)>>8|(re&255)<<8)>>1}var he=(function(e,t,r){for(var o=e.length,i=0,n=new fe(t);i<o;++i)e[i]&&++n[e[i]-1];var c=new fe(t);for(i=1;i<t;++i)c[i]=c[i-1]+n[i-1]<<1;var a;if(r){a=new fe(1<<t);var s=15-t;for(i=0;i<o;++i)if(e[i])for(var d=i<<4|e[i],u=t-e[i],l=c[e[i]-1]++<<u,f=l|(1<<u)-1;l<=f;++l)a[Pe[l]>>s]=d}else for(a=new fe(o),i=0;i<o;++i)e[i]&&(a[i]=Pe[c[e[i]-1]++]>>15-e[i]);return a}),ve=new Y(288);for(var O=0;O<144;++O)ve[O]=8;for(var O=144;O<256;++O)ve[O]=9;for(var O=256;O<280;++O)ve[O]=7;for(var O=280;O<288;++O)ve[O]=8;var At=new Y(32);for(var O=0;O<32;++O)At[O]=5;var Nt=he(ve,9,1),Vt=he(At,5,1),_e=function(e){for(var t=e[0],r=1;r<e.length;++r)e[r]>t&&(t=e[r]);return t},Q=function(e,t,r){var o=t/8|0;return(e[o]|e[o+1]<<8)>>(t&7)&r},ke=function(e,t){var r=t/8|0;return(e[r]|e[r+1]<<8|e[r+2]<<16)>>(t&7)},Xt=function(e){return(e+7)/8|0},Ht=function(e,t,r){return(r==null||r>e.length)&&(r=e.length),new Y(e.subarray(t,r))},jt=["unexpected EOF","invalid block type","invalid length/literal","invalid distance","stream finished","no stream handler",,"no callback","invalid UTF-8 data","extra field too long","date not in range 1980-2099","filename too long","stream finishing","invalid zip data"],W=function(e,t,r){var o=new Error(t||jt[e]);if(o.code=e,Error.captureStackTrace&&Error.captureStackTrace(o,W),!r)throw o;return o},Fe=function(e,t,r,o){var i=e.length,n=0;if(!i||t.f&&!t.l)return r||new Y(0);var c=!r,a=c||t.i!=2,s=t.i;c&&(r=new Y(i*3));var d=function(Xe){var He=r.length;if(Xe>He){var je=new Y(Math.max(He*2,Xe));je.set(r),r=je}},u=t.f||0,l=t.p||0,f=t.b||0,p=t.l,v=t.d,h=t.m,x=t.n,w=i*8;do{if(!p){u=Q(e,l,1);var _=Q(e,l+1,3);if(l+=3,_)if(_==1)p=Nt,v=Vt,h=9,x=5;else if(_==2){var g=Q(e,l,31)+257,b=Q(e,l+10,15)+4,B=g+Q(e,l+5,31)+1;l+=14;for(var S=new Y(B),C=new Y(19),y=0;y<b;++y)C[zt[y]]=Q(e,l+y*3,7);l+=b*3;for(var T=_e(C),R=(1<<T)-1,P=he(C,T,1),y=0;y<B;){var A=P[Q(e,l,R)];l+=A&15;var E=A>>4;if(E<16)S[y++]=E;else{var L=0,U=0;for(E==16?(U=3+Q(e,l,3),l+=2,L=S[y-1]):E==17?(U=3+Q(e,l,7),l+=3):E==18&&(U=11+Q(e,l,127),l+=7);U--;)S[y++]=L}}var J=S.subarray(0,g),k=S.subarray(g);h=_e(J),x=_e(k),p=he(J,h,1),v=he(k,x,1)}else W(1);else{var E=Xt(l)+4,m=e[E-4]|e[E-3]<<8,M=E+m;if(M>i){s&&W(0);break}a&&d(f+m),r.set(e.subarray(E,M),f),t.b=f+=m,t.p=l=M*8,t.f=u;continue}if(l>w){s&&W(0);break}}a&&d(f+131072);for(var I=(1<<h)-1,F=(1<<x)-1,D=l;;D=l){var L=p[ke(e,l)&I],z=L>>4;if(l+=L&15,l>w){s&&W(0);break}if(L||W(2),z<256)r[f++]=z;else if(z==256){D=l,p=null;break}else{var ee=z-254;if(z>264){var y=z-257,N=_t[y];ee=Q(e,l,(1<<N)-1)+Et[y],l+=N}var j=v[ke(e,l)&F],ae=j>>4;j||W(3),l+=j&15;var k=Ot[ae];if(ae>3){var N=kt[ae];k+=ke(e,l)&(1<<N)-1,l+=N}if(l>w){s&&W(0);break}a&&d(f+131072);var xe=f+ee;if(f<k){var Ve=n-k,Tt=Math.min(k,xe);for(Ve+f<0&&W(3);f<Tt;++f)r[f]=o[Ve+f]}for(;f<xe;++f)r[f]=r[f-k]}}t.l=p,t.p=D,t.b=f,t.f=u,p&&(u=1,t.m=h,t.d=v,t.n=x)}while(!u);return f!=r.length&&c?Ht(r,0,f):r.subarray(0,f)},Wt=new Y(0),Yt=function(e){(e[0]!=31||e[1]!=139||e[2]!=8)&&W(6,"invalid gzip data");var t=e[3],r=10;t&4&&(r+=(e[10]|e[11]<<8)+2);for(var o=(t>>3&1)+(t>>4&1);o>0;o-=!e[r++]);return r+(t&2)},Zt=function(e){var t=e.length;return(e[t-4]|e[t-3]<<8|e[t-2]<<16|e[t-1]<<24)>>>0},Kt=function(e,t){return((e[0]&15)!=8||e[0]>>4>7||(e[0]<<8|e[1])%31)&&W(6,"invalid zlib data"),(e[1]>>5&1)==1&&W(6,"invalid zlib data: "+(e[1]&32?"need":"unexpected")+" dictionary"),(e[1]>>3&4)+2};function qt(e,t){return Fe(e,{i:2},t,t)}function Jt(e,t){var r=Yt(e);return r+8>e.length&&W(6,"invalid gzip data"),Fe(e.subarray(r,-8),{i:2},new Y(Zt(e)),t)}function Qt(e,t){return Fe(e.subarray(Kt(e),-4),{i:2},t,t)}function er(e,t){return e[0]==31&&e[1]==139&&e[2]==8?Jt(e,t):(e[0]&15)!=8||e[0]>>4>7||(e[0]<<8|e[1])%31?qt(e,t):Qt(e,t)}var tr=typeof TextDecoder<"u"&&new TextDecoder,rr=0;try{tr.decode(Wt,{stream:!0}),rr=1}catch{}function H(e,t,r){for(var o="",i=t;i<t+r;i++)o+=String.fromCharCode(e.getUint8(i));return o}function We(e){return new Uint8Array([e>>24&255,e>>16&255,e>>8&255,e&255])}function Ye(e){return new Uint8Array([e>>8&255,e&255])}function Mt(e){return Uint8Array.from(Array.from(e).map(t=>t.charCodeAt(0)))}function ie(...e){const t=new Uint8Array(e.reduce((r,o)=>r+o.byteLength,0));return e.reduce((r,o)=>(t.set(new Uint8Array(o),r),r+o.byteLength),0),t.buffer}function De(e,t){if(!document)return console.error("[MiNi exif]: download file is browser only");if(!t)return console.error("[MiNi exif]: download missing output filename");if(!e||!(e instanceof ArrayBuffer)&&!(e instanceof Blob))return console.error("[MiNi exif]: download wrong data input");let r;e instanceof ArrayBuffer&&(r=new Blob([e]));var o=document.createElement("a");o.href=URL.createObjectURL(r),o.download=t,o.click()}var ir={256:"ImageWidth",257:"ImageHeight",34665:"ExifIFDPointer",34675:"ICCProfileIFDPointer",34853:"GPSInfoIFDPointer",258:"BitsPerSample",259:"Compression",262:"PhotometricInterpretation",274:"Orientation",277:"SamplesPerPixel",284:"PlanarConfiguration",530:"YCbCrSubSampling",531:"YCbCrPositioning",282:"XResolution",283:"YResolution",296:"ResolutionUnit",273:"StripOffsets",278:"RowsPerStrip",279:"StripByteCounts",513:"JPEGInterchangeFormat",514:"JPEGInterchangeFormatLength",301:"TransferFunction",318:"WhitePoint",319:"PrimaryChromaticities",529:"YCbCrCoefficients",532:"ReferenceBlackWhite",306:"DateTime",270:"ImageDescription",271:"Make",272:"Model",305:"Software",315:"Artist",316:"HostComputer",33432:"Copyright"},or={36864:"ExifVersion",40960:"FlashpixVersion",40961:"ColorSpace",40962:"PixelXDimension",40963:"PixelYDimension",37121:"ComponentsConfiguration",37122:"CompressedBitsPerPixel",40964:"RelatedSoundFile",36867:"DateTimeOriginal",36868:"DateTimeDigitized",37520:"SubsecTime",37521:"SubsecTimeOriginal",37522:"SubsecTimeDigitized",33434:"ExposureTime",33437:"FNumber",34850:"ExposureProgram",34852:"SpectralSensitivity",34855:"ISOSpeedRatings",34856:"OECF",37377:"ShutterSpeedValue",37378:"ApertureValue",37379:"BrightnessValue",37380:"ExposureBias",37381:"MaxApertureValue",37382:"SubjectDistance",37383:"MeteringMode",37384:"LightSource",37385:"Flash",37396:"SubjectArea",37386:"FocalLength",41483:"FlashEnergy",41484:"SpatialFrequencyResponse",41486:"FocalPlaneXResolution",41487:"FocalPlaneYResolution",41488:"FocalPlaneResolutionUnit",41492:"SubjectLocation",41493:"ExposureIndex",41495:"SensingMethod",41728:"FileSource",41729:"SceneType",41730:"CFAPattern",41985:"CustomRendered",41986:"ExposureMode",41987:"WhiteBalance",41988:"DigitalZoomRation",41989:"FocalLengthIn35mmFilm",41990:"SceneCaptureType",41991:"GainControl",41992:"Contrast",41993:"Saturation",41994:"Sharpness",41995:"DeviceSettingDescription",41996:"SubjectDistanceRange",42035:"LensMake",42036:"LensModel",42016:"ImageUniqueID"},nr={0:"GPSVersionID",1:"GPSLatitudeRef",2:"GPSLatitude",3:"GPSLongitudeRef",4:"GPSLongitude",5:"GPSAltitudeRef",6:"GPSAltitude",7:"GPSTimeStamp",8:"GPSSatellites",9:"GPSStatus",10:"GPSMeasureMode",11:"GPSDOP",12:"GPSSpeedRef",13:"GPSSpeed",14:"GPSTrackRef",15:"GPSTrack",16:"GPSImgDirectionRef",17:"GPSImgDirection",18:"GPSMapDatum",19:"GPSDestLatitudeRef",20:"GPSDestLatitude",21:"GPSDestLongitudeRef",22:"GPSDestLongitude",23:"GPSDestBearingRef",24:"GPSDestBearing",25:"GPSDestDistanceRef",26:"GPSDestDistance",27:"GPSProcessingMethod",28:"GPSAreaInformation",29:"GPSDateStamp",30:"GPSDifferential"},pe={ExposureMode:{0:"Auto",1:"Manual",2:"Auto Bracket"},ExposureProgram:{0:"Not defined",1:"Manual",2:"Normal program",3:"Aperture priority",4:"Shutter priority",5:"Creative program",6:"Action program",7:"Portrait mode",8:"Landscape mode"},MeteringMode:{0:"Unknown",1:"Average",2:"CenterWeightedAverage",3:"Spot",4:"MultiSpot",5:"Pattern",6:"Partial",255:"Other"},LightSource:{0:"Unknown",1:"Daylight",2:"Fluorescent",3:"Tungsten (incandescent light)",4:"Flash",9:"Fine weather",10:"Cloudy weather",11:"Shade",12:"Daylight fluorescent (D 5700 - 7100K)",13:"Day white fluorescent (N 4600 - 5400K)",14:"Cool white fluorescent (W 3900 - 4500K)",15:"White fluorescent (WW 3200 - 3700K)",17:"Standard light A",18:"Standard light B",19:"Standard light C",20:"D55",21:"D65",22:"D75",23:"D50",24:"ISO studio tungsten",255:"Other"},Flash:{0:"Flash did not fire",1:"Flash fired",5:"Strobe return light not detected",7:"Strobe return light detected",9:"Flash fired, compulsory flash mode",13:"Flash fired, compulsory flash mode, return light not detected",15:"Flash fired, compulsory flash mode, return light detected",16:"Flash did not fire, compulsory flash mode",24:"Flash did not fire, auto mode",25:"Flash fired, auto mode",29:"Flash fired, auto mode, return light not detected",31:"Flash fired, auto mode, return light detected",32:"No flash function",65:"Flash fired, red-eye reduction mode",69:"Flash fired, red-eye reduction mode, return light not detected",71:"Flash fired, red-eye reduction mode, return light detected",73:"Flash fired, compulsory flash mode, red-eye reduction mode",77:"Flash fired, compulsory flash mode, red-eye reduction mode, return light not detected",79:"Flash fired, compulsory flash mode, red-eye reduction mode, return light detected",89:"Flash fired, auto mode, red-eye reduction mode",93:"Flash fired, auto mode, return light not detected, red-eye reduction mode",95:"Flash fired, auto mode, return light detected, red-eye reduction mode"},SensingMethod:{1:"Not defined",2:"One-chip color area sensor",3:"Two-chip color area sensor",4:"Three-chip color area sensor",5:"Color sequential area sensor",7:"Trilinear sensor",8:"Color sequential linear sensor"},SceneCaptureType:{0:"Standard",1:"Landscape",2:"Portrait",3:"Night scene"},SceneType:{1:"Directly photographed"},CustomRendered:{0:"Normal process",1:"Custom process"},WhiteBalance:{0:"Auto white balance",1:"Manual white balance"},GainControl:{0:"None",1:"Low gain up",2:"High gain up",3:"Low gain down",4:"High gain down"},Contrast:{0:"Normal",1:"Soft",2:"Hard"},Saturation:{0:"Normal",1:"Low saturation",2:"High saturation"},Sharpness:{0:"Normal",1:"Soft",2:"Hard"},SubjectDistanceRange:{0:"Unknown",1:"Macro",2:"Close view",3:"Distant view"},FileSource:{3:"DSC"},Components:{0:"",1:"Y",2:"Cb",3:"Cr",4:"R",5:"G",6:"B"},ColorSpace:{1:"sRGB",2:"Adobe RGB",65533:"Wide Gamut RGB",65534:"ICC Profile",65535:"Uncalibrated"}};function $e(e,t,r,o,i){var n=e.getUint16(r,!i),c={},a,s,d;for(d=0;d<n;d++){a=r+d*12+2;const u=e.getUint16(a,!i);s=o[u],s&&(c[s]=ar(e,a,t,r,i))}return c}function ar(e,t,r,o,i){var n=e.getUint16(t+2,!i),c=e.getUint32(t+4,!i),a=e.getUint32(t+8,!i)+r,s,d,u,l,f,p;switch(n){case 1:case 7:if(c==1)s=t+8,u=e.getUint8(s,!i);else for(s=c>4?a:t+8,d=[],l=0;l<c;l++)d[l]=e.getUint8(s+l);break;case 2:s=c>4?a:t+8,d=H(e,s,c-1),d.length;break;case 3:if(c==1)s=t+8,u=e.getUint16(s,!i);else for(s=c>2?a:t+8,d=[],l=0;l<c;l++)d[l]=e.getUint16(s+2*l,!i);break;case 4:if(c==1)s=t+8,u=e.getUint32(s,!i);else for(s=a,d=[],l=0;l<c;l++)d[l]=e.getUint32(s+4*l,!i);break;case 9:if(c==1)s=t+8,u=e.getInt32(s,!i);else for(s=a,d=[],l=0;l<c;l++)d[l]=e.getInt32(s+4*l,!i);break;case 5:if(c==1)s=a,f=e.getUint32(s,!i),p=e.getUint32(s+4,!i),u=new Number(f/p),u.numerator=f,u.denominator=p;else for(s=a,d=[],l=0;l<c;l++)f=e.getUint32(s+8*l,!i),p=e.getUint32(s+4+8*l,!i),d[l]=new Number(f/p),d[l].numerator=f,d[l].denominator=p;break;case 10:if(c==1)s=a,f=e.getInt32(s,!i),p=e.getInt32(s+4,!i),u=new Number(f/p),u.numerator=f,u.denominator=p;else for(s=a,d=[],l=0;l<c;l++)f=e.getInt32(s+8*l,!i),p=e.getInt32(s+4+8*l,!i),d[l]=new Number(f/p),d[l].numerator=f,d[l].denominator=p;break}if(n)return{value:d||u,offset:s-r,type:n}}function ze(e,t=0){if(!(e instanceof ArrayBuffer))return console.error("[MiNi exif]: input must be an ArrayBuffer");var r,o,i,n,c;const a=new DataView(e);if(a.getUint16(t)==18761)r=!1;else if(a.getUint16(t)==19789)r=!0;else return console.error("[MiNi exif]: Not valid TIFF data! (no 0x4949 or 0x4D4D)"),!1;if(a.getUint16(t+2,!r)!=42)return console.error("[MiNi exif]: Not valid TIFF data! (no 0x002A)"),!1;var s=a.getUint32(t+4,!r);if(s<8)return console.error("[MiNi exif]: Not valid TIFF data! (First offset less than 8)",a.getUint32(tiffOffset+4,!r)),!1;if(o={tiff:$e(a,t,t+s,ir,r)},o.tiff.ExifIFDPointer){n=$e(a,t,t+o.tiff.ExifIFDPointer.value,or,r);for(i in n)switch(i){case"LightSource":case"Flash":case"MeteringMode":case"ExposureMode":case"ExposureProgram":case"SensingMethod":case"SceneCaptureType":case"SceneType":case"CustomRendered":case"WhiteBalance":case"GainControl":case"Contrast":case"Saturation":case"Sharpness":case"SubjectDistanceRange":case"FileSource":case"ColorSpace":n[i].hvalue=pe[i][n[i].value];break;case"ExposureTime":n[i].hvalue=n[i].value.numerator+"/"+n[i].value.denominator;break;case"ShutterSpeedValue":n[i].hvalue="1/"+Math.round(Math.pow(2,n[i].value));break;case"ExifVersion":case"FlashpixVersion":n[i].hvalue=String.fromCharCode(n[i].value[0],n[i].value[1],n[i].value[2],n[i].value[3]);break;case"ApertureValue":case"BrightnessValue":n[i].hvalue=Math.round(n[i].value*1e3)/1e3;break;case"ComponentsConfiguration":n[i].hvalue=pe.Components[n[i].value[0]]+pe.Components[n[i].value[1]]+pe.Components[n[i].value[2]]+pe.Components[n[i].value[3]];break}o.exif=n,delete o.tiff.ExifIFDPointer}if(o.tiff.GPSInfoIFDPointer){c=$e(a,t,t+o.tiff.GPSInfoIFDPointer.value,nr,r);for(i in c)switch(i){case"GPSVersionID":c[i].hvalue=c[i].value[0]+"."+c[i].value[1]+"."+c[i].value[2]+"."+c[i].value[3];break;case"GPSLatitude":c[i].hvalue=c[i].value[0]+c[i].value[1]/60+c[i].value[2]/3600,c[i].hvalue=(c.GPSLatitudeRef.value==="N"?1:-1)*c[i].hvalue;break;case"GPSLongitude":c[i].hvalue=c[i].value[0]+c[i].value[1]/60+c[i].value[2]/3600,c[i].hvalue=(c.GPSLongitudeRef.value==="E"?1:-1)*c[i].hvalue;break;case"GPSTimeStamp":c[i].hvalue=c[i].value[0].toString().padStart(2,"0")+":"+c[i].value[1].toString().padStart(2,"0")+":"+c[i].value[2].toString().padStart(2,"0")+" UTC";break}o.gps=c,delete o.tiff.GPSInfoIFDPointer}return o}function Ue(e,t,r,o,i,n){if(!e||!r||!o||!i||!t)return!1;const c=["exif","tiff","gps"];if(!c.includes(r))return console.error("[MiNi exif]: area must be one of",c);if(!e[r][o])return console.error("[MiNi exif]: '"+r+"/"+o+"' not present");if(!t)return!1;if(n){if(typeof i!=typeof n)return console.error("[MiNi exif]: newvalue type mismatch vs newvalue2",i,n);if(Array.isArray(i)){let v=[];for(let h=0;h<i.length;h++){let x=new Number(i[h]/n[h]);x.numerator=i[h],x.denominator=n[h],v.push(x)}i=v}else{let v=new Number(i/n);v.numerator=i,v.denominator=n,i=v}}const a=e[r][o],s=a.value.length||1;if(typeof i!=typeof a.value)return console.error("[MiNi exif]: newvalue type mismatch vs oldvalue",a.value,i);if(s>1&&(!i.length||i.length<1||i.length>s))return console.error("[MiNi exif]: newvalue too long",a.value,i);if(s>1&&i.length<s)if(Array.isArray(a.value))for(let v=0;v<s-i.length;v++)i.push(0);else if(typeof a.value=="string")i=i.concat(" ".repeat(s-i.length));else return console.error("[MiNi exif]: unknown type",a.value,i);const d=new DataView(t);let u,l;if(d.getUint16(0)==18761?u=!1:d.getUint16(0)==19789&&(u=!0),u===void 0)return console.error("[MiNi exif]: exif_raw corrupted");const f=a.type,p=a.offset;switch(f){case 1:case 7:if(s==1)d.setUint8(p,i,!u);else for(l=0;l<s;l++)d.setUint8(p+l,i[l],!u);break;case 2:for(l=0;l<s;l++)d.setUint8(p+l,i.charCodeAt(l),!u);break;case 3:if(s==1)d.setUint16(p,i,!u);else for(l=0;l<s;l++)d.setUint16(p+l,i[l],!u);break;case 4:if(s==1)d.setUint32(p,i,!u);else for(l=0;l<s;l++)d.setUint32(p+l,i[l],!u);break;case 9:if(s==1)d.setInt32(p,i,!u);else for(l=0;l<s;l++)d.setInt32(p+l,i[l],!u);break;case 5:if(s==1)d.setUint32(p,i.numerator,!u),d.setUint32(p+4,i.denominator,!u);else for(l=0;l<s;l++)d.setUint32(p+8*l,i[l].numerator,!u),d.setUint32(p+4+8*l,i[l].denominator,!u);break;case 10:if(s==1)d.setInt32(p,i.numerator,!u),d.setInt32(p+4,i.denominator,!u);else for(l=0;l<s;l++)d.setInt32(p+8*l,i[l].numerator,!u),d.setInt32(p+4+8*l,i[l].denominator,!u);break}return t}function Ge(e,t=0){if(!(e instanceof ArrayBuffer))return console.error("[MiNi exif]: input must be an ArrayBuffer");const r=new DataView(e);if(r.getUint32(t+36)!==1633907568)return console.error("[MiNi exif]: ICC missing valid signature");const o=H(r,t+16,4),i=r.getUint32(t+128);let n=t+128+4,c={ColorSpace:o};for(let a=0;a<i;a++){let s=H(r,n,4),d=r.getUint32(n+4),u=r.getUint32(n+8);if(s==="desc"){s="ColorProfile";const l=H(r,t+d,4);let f=[];if(l==="mluc"){const p=r.getUint32(t+d+8);if(r.getUint32(t+d+12)!==12)return console.error("[MiNi exif]: ICC with invalid mluc");const v=t+d+16;for(let h=0;h<p;h++){const x=r.getUint32(v+h*12+4),w=r.getUint32(v+h*12+8);f.push(H(r,t+d+w,x).replaceAll("\0",""))}d+=28}else l==="desc"&&(u=r.getUint32(t+d+8),f.push(H(r,t+d+12,u).replaceAll("\0","")));c[s]=f}n+=12}return c}function we(e){if(!(e instanceof ArrayBuffer))return console.error("[MiNi exif]: input must be an ArrayBuffer");const t=e.byteLength,r=new DataView(e);if(r.getUint16(0)!==65496)return console.error("[MiNi exif]: data is not JPG");const o=65498;let i=[],n=null,c=2;for(i.push({marker:"0xFFD8",data:e.slice(0,2)});n!=o;){let a=c;n=r.getUint16(a);const s=r.getUint16(a+2),d=n.toString(16).toUpperCase().padStart(6,"0x");n!=o?i.push({marker:d,data:e.slice(c,c+2+s)}):i.push({marker:d,data:e.slice(c,t)}),c+=2+s}return i}function lr(e){const t=we(e);let r,o;const i=t.filter(c=>c.marker==="0xFFE1");i?.length&&i.forEach(c=>{String.fromCharCode(...new Uint8Array(c.data.slice(4,8)))==="Exif"?r=c:o=c});const n=sr(e,t);return{exif:r?.data,icc:n?.data,xml:o?.data}}function sr(e,t){const r="ICC_PROFILE\0";t||(t=we(e));const o=t.find(i=>i.marker==="0xFFE2");return o?String.fromCharCode(...new Uint8Array(o.data.slice(4,16)))!==r?(console.error("[MiNi exif]: ICC_PROFILE missing"),null):o:null}function cr(e){if(!e)return console.error("[MiNi exif]: please load file first");const t=we(e).filter(r=>r.marker!=="0xFFE1");return ie(...t.map(r=>r.data))}function ur(e){const t=Ye(65505).buffer,r=Ye(e.byteLength+8).buffer,o=Mt("Exif\0\0").buffer;return ie(t,r,o,e)}function Ze(e,t){if(!e)return console.error("[MiNi exif]: please load file first");if(!t)return console.error("[MiNi exif]: exif data missing");const r=we(e).filter(i=>i.marker!=="0xFFE1"),o=ur(t);return ie(r[0].data,o,...r.slice(1).map(i=>i.data))}function fr(e){let t=e,r,o,i,n,c;function a(){if(t){const{exif:s,icc:d,xml:u}=lr(t);r=s,o=d,i=u}if(r?(n=ze(r,10),c=r.slice(10)):(n=null,c=null),o&&(n={...n,icc:Ge(o,18)}),i){const s=new TextDecoder().decode(i.slice(4));n={...n,xml:s}}}return a(),{load:s=>{t=s,a()},remove:()=>(t=cr(t),a(),t),read:()=>({...n,format:"JPG"}),extract:()=>c,image:()=>t,replace:s=>(t=Ze(t,s),a(),t),download:s=>De(t,s),patch:s=>{function d(u){if(u instanceof Object){const{area:l,field:f,value:p,value2:v}=u;if(!l||!f||p===void 0)return console.error("[MiNi exif]: patch missing input",l,f,p);c=Ue(n,c,l,f,p,v)}else return console.error("[MiNi exif]: patch wrong input",u)}if(!n)return console.error("[MiNi exif]: no exif data");s instanceof Array?s.forEach(u=>d(u)):s instanceof Object&&d(s),t=Ze(t,c),a()}}}let be;function dr(e){if(!be){be=new Uint32Array(256);for(let i=0;i<256;i++){let n=i;for(let c=0;c<8;c++)n&1?n=3988292384^n>>>1:n=n>>>1;be[i]=n}}for(var t=-1,r=new Uint8Array(e),o=0;o<e.byteLength;o++)t=t>>>8^be[(t^r[o])&255];return(t^-1)>>>0}function pr(e,t,r){const o=e.getUint32(t),i=H(e,t+4,4),n=t+8,c=e.getUint32(t+8+o),a=r.slice(t,t+12+o);return{len:o,type:i,data:a,dataoffset:n,crc:c}}function Oe(e){return e.data.slice(8,-4)}function hr(e,t){const r=e.byteLength,o=We(e.byteLength).buffer,i=Mt(t).buffer;let n=ie(o,i,e);const c=dr(n.slice(4)),a=We(c).buffer;return n=ie(n,a),{len:r,type:t,data:n,crc:c}}function ge(e){if(!(e instanceof ArrayBuffer))return console.error("[MiNi exif]: input must be an ArrayBuffer");const t=e.byteLength,r=new DataView(e);if(r.getUint32(0)!==2303741511||r.getUint32(4)!==218765834)return console.error("[MiNi exif]: data is not PNG");let o=8,i=[{len:8,type:"",data:e.slice(0,8),dataoffset:0,crc:0}];for(;o<t;){const n=pr(r,o,e);i.push(n),o+=12+n.len}return i}function vr(e){const t=ge(e);let r=t.find(n=>n.type==="eXIf");r&&(r=Oe(r));let o=mr(e,t);if(o){let n=!0,c=0,a=new Uint8Array(o);for(;n!==0;)n=a[c++];c++,a=a.slice(c),o=er(new Uint8Array(a))?.buffer}let i=gr(e,t);return{exif:r,icc:o,xml:i}}function gr(e,t){t||(t=ge(e));let r=null;const o=t.filter(i=>i.type==="iTXt");return o?.length&&o.forEach(i=>{const n=Oe(i);String.fromCharCode(...new Uint8Array(n.slice(0,3)))==="XML"&&(r=n)}),r}function mr(e,t){t||(t=ge(e));const r=t.find(o=>o.type==="iCCP");return r?Oe(r):null}function xr(e){if(!e)return console.error("[MiNi exif]: please load file first");const t=ge(e).filter(r=>r.type!=="eXIf"&&r.type!=="iTXt");return ie(...t.map(r=>r.data))}function Ke(e,t){if(!e)return console.error("[MiNi exif]: please load file first");if(!t)return console.error("[MiNi exif]: exif data missing");const r=ge(e).filter(i=>i.type!=="eXIf"&&i.type!=="iTXt"),o=hr(t,"eXIf");return ie(...r.slice(0,2).map(i=>i.data),o.data,...r.slice(2).map(i=>i.data))}function br(e){let t=e,r,o,i,n,c;function a(){if(t){const{exif:s,icc:d,xml:u}=vr(t);r=s,o=d,i=u}if(r?(n=ze(r,0),c=r.slice(0)):(n=null,c=null),o&&(n={...n,icc:Ge(o,0)}),i){const s=new TextDecoder().decode(i);n={...n,xml:s}}}return a(),{load:s=>{t=s,a()},remove:()=>(t=xr(t),a(),t),read:()=>({...n,format:"PNG"}),extract:()=>c,image:()=>t,replace:s=>(t=Ke(t,s),a(),t),download:s=>De(t,s),patch:s=>{function d(u){if(u instanceof Object){const{area:l,field:f,value:p,value2:v}=u;if(!l||!f||p===void 0)return console.error("[MiNi exif]: patch input missing",l,f,p);c=Ue(n,c,l,f,p,v)}else return console.error("[MiNi exif]: patch input wrong",u)}if(!n)return console.error("[MiNi exif]: no exif data");s instanceof Array?s.forEach(u=>d(u)):s instanceof Object&&d(s),t=Ke(t,c),a()}}}function yr(e,t){const r=e.getUint32(t);return r===0?{length:e.byteLength-t,contentOffset:t+4+4}:r===1&&e.getUint32(t+8)===0?{length:e.getUint32(t+12),contentOffset:t+4+4+8}:{length:r,contentOffset:t+4+4}}function wr(e,t){const{length:r,contentOffset:o}=yr(e,t);return r<8?void 0:{type:e.getUint32(t+4),length:r,str:H(e,t+4,4),contentOffset:o}}function qe(e,t){let r={},o=t.length-8,i=t.contentOffset;for(;o>0;){const n=H(e,i+4,4),c=e.getUint32(i);r[n]={length:c,str:n,contentOffset:i+8},i+=c,o-=c}return r}function Cr(e){if(!(e instanceof ArrayBuffer))return console.error("[MiNi exif]: input must be an ArrayBuffer");e.byteLength;const t=new DataView(e);if(t.getUint32(4)!==1718909296&&t.getUint32(8)!==1751476579||t.getUint32(4)!==1718909296&&t.getUint32(8)!==1635150182)return console.error("[MiNi exif]: data is not HEIC/AVIF");let r={};t.getUint32(8)===1751476579?r={_format:"HEIC"}:r={_format:"AVIF"};let o=0,i,n,c={},a={};for(;o+4+4<=t.byteLength;){const s=wr(t,o);if(s===void 0)break;if(s.str==="meta"){o+=12;continue}if(s.str==="iinf"){let d=t.getUint32(s.contentOffset+2),u=s.contentOffset+8+2;for(let l=0;l<d;l++)if(t.getUint32(u+12)===1165519206?i=t.getUint32(u+8):t.getUint32(u+12)===1835625829&&(n=t.getUint32(u+8)),l+1<d)for(u+=16;t.getUint32(u)!==1768842853&&u<2e4;)u++}else if(s.str==="iloc"){t.getUint32(s.contentOffset+2);const d=t.getUint16(s.contentOffset+6),u=(s.length-16)/d,l=s.contentOffset+8;for(let f=0;f<d;f++)if(u===16){const p=t.getUint32(l+f*u),v=t.getUint32(l+f*u+8),h=t.getUint32(l+f*u+12);a[p]={id:p,off:v,size:h,type:"heic"}}else if(u===18){const p=t.getUint32(l+f*u);let v=t.getUint32(l+f*u+4);v||(v=t.getUint32(l+f*u+10));const h=t.getUint32(l+f*u+14);a[p]={id:p,off:v,size:h,type:"avif"}}else console.error("[MiNi exif]: unknown iloc block length",u)}else if(s.str==="iprp"){const d=qe(t,s);if(d.ipco){const u=qe(t,d.ipco);if(u.colr){const l=H(t,u.colr.contentOffset,4);if(l==="prof"||l==="rICC"){const f=u.colr.contentOffset+4;c={offset:f,data:e.slice(f,f+u.colr.length-8)}}}}}o+=s.length}if(i&&a[i]){const{off:s,size:d,type:u}=a[i];if(u==="heic"){const l=t.getUint32(s),f=e.slice(s+4+l,s+4+l+d-4-l);r.exif={data:f,offset:s+4+l}}else if(u==="avif"){const l=t.getUint32(s),f=e.slice(s+4+l,s+4+l+d-4-l);r.exif={data:f,offset:s+4+l}}}if(n&&a[n]){const{off:s,size:d,type:u}=a[n];if(u==="heic"){const l=e.slice(s,s+d);r.xml={data:l,offset:s}}else if(u==="avif"){const l=e.slice(s,s+d);r.xml={data:l,offset:s}}}return r.icc=c,r}function Je(e,t,r){if(!e)return console.error("[MiNi exif]: please load file first");if(!t)return console.error("[MiNi exif]: exif data missing");const o=r.offset,i=r.data.byteLength;return ie(e.slice(0,o),t,e.slice(o+i))}function _r(e){let t=e,r,o,i,n,c;function a(){if(t){const{exif:d,icc:u,xml:l,_format:f}=Cr(t);o=d,i=u,n=l,r=f}s()}function s(){if(o?.data?(c=ze(o.data,0),c={...c,format:r}):c=null,i?.data&&(c={...c,icc:Ge(i.data,0)}),n){const d=new TextDecoder().decode(n.data);c={...c,xml:d}}}return a(),{load:d=>{t=d,a()},read:()=>c,extract:()=>o.data,image:()=>t,download:d=>De(t,d),replace:d=>d.byteLength!==o.data.byteLength?console.error("[MiNi exif]: new exif length must be "+o.data.byteLength+" bytes"):(t=Je(t,d,o),a(),t),patch:d=>{function u(l){if(l instanceof Object){const{area:f,field:p,value:v,value2:h}=l;if(!f||!p||v===void 0)return console.error("[MiNi exif]: patch missing input",f,p,v);o.data=Ue(c,o.data,f,p,v,h)}else return console.error("[MiNi exif]: patch wrong input",l)}if(!c)return console.error("[MiNi exif]: no exif data");d instanceof Array?d.forEach(l=>u(l)):d instanceof Object&&u(d),t=Je(t,o.data,o),a()}}}function kr(e,t){const r=e.getUint32(t);return r===0?{length:e.byteLength-t,contentOffset:t+4+4}:r===1&&e.getUint32(t+8)===0?{length:e.getUint32(t+12),contentOffset:t+4+4+8}:{length:r,contentOffset:t+4+4}}function $r(e,t){const{length:r,contentOffset:o}=kr(e,t);return r<8?void 0:{type:e.getUint32(t+4),length:r,str:H(e,t+4,4),contentOffset:o}}function Qe(e,t){let r={},o=t.length-8,i=t.contentOffset;for(;o>0;){const n=H(e,i+4,4),c=e.getUint32(i);r[n]={length:c,str:n,contentOffset:i+8},i+=c,o-=c}return r}function Sr(e){if(!(e instanceof ArrayBuffer))return console.error("[MiNi exif]: input must be an ArrayBuffer");e.byteLength;const t=new DataView(e);if(!(t.getUint32(4)===1718909296&&t.getUint32(8)===1903435808))return console.error("[MiNi exif]: data is not QuickTime");let r=0,o=[],i=[];for(;r+4+4<=t.byteLength;){const c=$r(t,r);if(c===void 0)break;if(c.str==="meta"){r+=12;continue}if(c.str==="moov"){const a=Qe(t,c);if(a.meta){const s=Qe(t,a.meta);let d;if(s.keys){let u=s.keys.contentOffset;s.length,d=t.getUint32(u+4),u=u+8;for(let l=0;l<d;l++){const f=t.getUint32(u);if(t.getUint32(u+4)!==1835299937)continue;const p=H(t,u+8,f-8);o.push(p),u+=f}o=o.map(l=>l.replace("com.apple.quicktime.",""))}if(s.ilst){let u=s.ilst.contentOffset;for(let l=0;l<d;l++){const f=t.getUint32(u),p=t.getUint32(u+8);if(t.getUint32(u+12)!==1684108385)continue;const v=H(t,u+16+8,p-8-8);i.push({value:v,offset:u+16+8,type:2}),u+=f}}}}r+=c.length}let n={};if(o.length&&i.length){let c=o.reduce((a,s,d)=>(a[s]=i[d],a),{});if(n.meta=c,n.meta["location.ISO6709"]){const a=n.meta["location.ISO6709"].value;n.gps={GPSLatitude:{value:parseFloat(a)},GPSLongitude:{value:parseFloat(a.slice(8))},GPSAltitude:{value:parseFloat(a.slice(17))}}}}return n}function Bt(e,t=!1){if(!(e instanceof ArrayBuffer))return console.error("[MiNi exif]: input must be an ArrayBuffer");const r=new DataView(e);if(r.getUint16(0)===65496)return fr(e);if(r.getUint32(0)===2303741511&&r.getUint32(4)===218765834)return br(e);if(r.getUint32(4)===1718909296&&(r.getUint32(8)===1751476579||r.getUint32(8)===1635150182))return _r(e);if(t||r.getUint32(4)===1718909296&&r.getUint32(8)===1903435808)return Sr(e);console.error("[MiNi exif]: unknown format")}function Er(e,t){const{gl:r,img:o}=e;t=t||{translateX:0,translateY:0,angle:0,scale:0,flipv:0,fliph:0};let{translateX:i,translateY:n,angle:c,scale:a,flipv:s,fliph:d}=t;a+=1;let u=[a,a];const l=[Math.round(r.canvas.width*i*100)/100,Math.round(r.canvas.height*n*100)/100],f=`#version 300 es
        in vec2 vertex;
        uniform mat3 matrix;
        out vec2 texCoord;
        void main() {
          texCoord = vertex;
          gl_Position = vec4((matrix * vec3(vertex, 1)).xy, 0, 1);
        }
      `,p=`#version 300 es
        precision highp float;
        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;   
        void main() {
          outColor = texture(_texture, vec2(texCoord.x, texCoord.y));
        }
      `;if(r.canvas.width===e.height){const E=o.width/o.height;u[0]*=E,u[1]/=E}const v=X.projection(r.canvas.width,r.canvas.height),h=X.translation(l[0],l[1]),x=X.rotation(-c*Math.PI/180),w=X.scaling(u[0]*(-d||1),u[1]*(-s||1));let _=[1,0,0,0,1,0,0,0,1];_=X.multiply(_,v),_=X.multiply(_,h),_=X.multiply(_,X.translation(r.canvas.width/2,r.canvas.height/2)),_=X.multiply(_,x),_=X.multiply(_,w),_=X.multiply(_,X.translation(-r.canvas.width/2,-r.canvas.height/2)),_=X.multiply(_,X.scaling(r.canvas.width,r.canvas.height)),e._.$matrix=e._.$matrix||new V(r,f,p),e.runFilter(e._.$matrix,{matrix:_})}var X={projection:function(e,t){return[2/e,0,0,0,2/t,0,-1,-1,1]},translation:function(e,t){return[1,0,0,0,1,0,e,t,1]},rotation:function(e){var t=Math.cos(e),r=Math.sin(e);return[t,-r,0,r,t,0,0,0,1]},scaling:function(e,t){return[e,0,0,0,t,0,0,0,1]},multiply:function(e,t){var r=e[0],o=e[1],i=e[2],n=e[3],c=e[4],a=e[5],s=e[6],d=e[7],u=e[8],l=t[0],f=t[1],p=t[2],v=t[3],h=t[4],x=t[5],w=t[6],_=t[7],E=t[8];return[l*r+f*n+p*s,l*o+f*c+p*d,l*i+f*a+p*u,v*r+h*n+x*s,v*o+h*c+x*d,v*i+h*a+x*u,w*r+_*n+E*s,w*o+_*c+E*d,w*i+_*a+E*u]}};function Ar(e,t,r){const{gl:o}=e;r+=1;const i=`
    vec3 fromLinear(vec3 linearRGB) {
        bvec3 cutoff = lessThan(linearRGB.rgb, vec3(0.0031308));
        vec3 higher = vec3(1.055)*pow(linearRGB.rgb, vec3(1.0/2.4)) - vec3(0.055);
        vec3 lower = linearRGB.rgb * vec3(12.92);
        return vec3(mix(higher, lower, cutoff));
    }
    vec3 toLinear(vec3 sRGB) {
        bvec3 cutoff = lessThan(sRGB.rgb, vec3(0.04045));
        vec3 higher = pow((sRGB.rgb + vec3(0.055))/vec3(1.055), vec3(2.4));
        vec3 lower = sRGB.rgb/vec3(12.92);
        return vec3(mix(higher, lower, cutoff));
    }`;if(t.type==="1"){const n=`#version 300 es
        precision highp float;

        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform sampler2D map;
        uniform float filterStrength;

        ${i}

        vec4 lut(vec4 color) {
          vec3 texel = color.rgb;
          texel = fromLinear(texel);
          float size = 33.0;
          float sliceSize = 1.0 / size;
          float slicePixelSize = sliceSize / size;
          float sliceInnerSize = slicePixelSize * (size - 1.0);
          float xOffset = 0.5 * sliceSize + texel.x * (1.0 - sliceSize);
          float yOffset = 0.5 * slicePixelSize + texel.y * sliceInnerSize;
          float zOffset = texel.z * (size - 1.0);
          float zSlice0 = floor(zOffset);
          float zSlice1 = zSlice0 + 1.0;
          float s0 = yOffset + (zSlice0 * sliceSize);
          float s1 = yOffset + (zSlice1 * sliceSize);
          vec4 slice0Color = texture(map, vec2(xOffset, s0));
          vec4 slice1Color = texture(map, vec2(xOffset, s1));
          texel =  mix(slice0Color, slice1Color, zOffset - zSlice0).rgb;
          texel = toLinear(texel);
          return vec4(texel, color.a);
        }

        void main() {
          vec4 color = texture(_texture, texCoord);
          outColor = color * (1.0 - filterStrength) + lut(color) * filterStrength;
        }
    `;e._.$insta1=e._.$insta1||new V(o,null,n),e._.$instatxt1=e._.$instatxt1||new K(o),e._.$instatxt1.loadImage(t.map1,o.RGBA),e._.$instatxt1.use(1),e.runFilter(e._.$insta1,{filterStrength:r??1,map:{unit:1}})}else if(t.type==="2"){const n=`#version 300 es
        precision highp float;
        precision highp int;
        
        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform sampler2D map;
        uniform sampler2D map2;
        uniform float filterStrength;

        ${i}

        vec4 lut(vec4 color) {
          vec3 texel = color.rgb;
          texel = fromLinear(texel);
          texel.r = texture(map, vec2(texel.r, 0.5)).r;
          texel.g = texture(map, vec2(texel.g, 0.5)).g;
          texel.b = texture(map, vec2(texel.b, 0.5)).b;
          float luma = dot(vec3(0.2126, 0.7152, 0.0722), texel);
          float shadowCoeff = 0.35 * max(0.0, 1.0 - luma);
          texel = mix(texel, max(vec3(0.0), 2.0 * texel - 1.0), shadowCoeff);
          texel = mix(texel, vec3(luma), -0.3);
          texel.r = texture(map2, vec2(texel.r, 0.5)).r;
          texel.g = texture(map2, vec2(texel.g, 0.5)).g;
          texel.b = texture(map2, vec2(texel.b, 0.5)).b;
          texel = toLinear(texel);
          return vec4(texel, color.a);
        }

        void main() {
          vec4 color = texture(_texture, texCoord);
          color = color * (1.0 - filterStrength) + lut(color) * filterStrength;
          outColor = color;
        }
    `;e._.$insta2=e._.$insta2||new V(o,null,n),e._.$instatxt1=e._.$instatxt1||new K(o),e._.$instatxt2=e._.$instatxt2||new K(o),e._.$instatxt1.loadImage(t.map1,o.RGBA),e._.$instatxt2.loadImage(t.map2,o.RGBA),e._.$instatxt1.use(1),e._.$instatxt2.use(2),e.runFilter(e._.$insta2,{filterStrength:r??1,map:{unit:1},map2:{unit:2}})}else if(t.type==="3"){const n=`#version 300 es
        precision highp float;
        precision highp int;
        
        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform sampler2D map;
        uniform sampler2D mapLgg;
        uniform float filterStrength;

        ${i}

        vec4 lut(vec4 color) {
          vec3 texel = color.rgb;
          texel = fromLinear(texel);
          texel = min(texel * 1.1343, vec3(1.0));
          texel.r = texture(map, vec2(texel.r, 0.5)).r;
          texel.g = texture(map, vec2(texel.g, 0.5)).g;
          texel.b = texture(map, vec2(texel.b, 0.5)).b;
          vec3 shadowColor = vec3(0.956862, 0.0, 0.83529);
          float luma = dot(vec3(0.309, 0.609, 0.082), texel);
          vec3 shadowBlend = 2.0 * shadowColor * texel;
          float shadowAmount = 0.6 * max(0.0, (1.0 - 4.0 * luma));
          texel = mix(texel, shadowBlend, shadowAmount);
          vec3 lgg;
          lgg.r = texture(mapLgg, vec2(texel.r, 0.5)).r;
          lgg.g = texture(mapLgg, vec2(texel.g, 0.5)).g;
          lgg.b = texture(mapLgg, vec2(texel.b, 0.5)).b;
          texel = mix(texel, lgg, min(1.0, 0.8 + luma));
          texel = toLinear(texel);
          return vec4(texel, color.a);
        }

        void main() {
          vec4 color = texture(_texture, texCoord);
          outColor = color * (1.0 - filterStrength) + lut(color) * filterStrength;
        }
    `;e._.$insta3=e._.$insta3||new V(o,null,n),e._.$instatxt1=e._.$instatxt1||new K(o,0,0,o.RGBA,o.UNSIGNED_BYTE),e._.$instatxt1.loadImage(t.map1,o.RGBA),e._.$instatxt2=e._.$instatxt2||new K(o,0,0,o.RGBA,o.UNSIGNED_BYTE),e._.$instatxt2.loadImage(t.map2,o.RGBA),e._.$instatxt1.use(1),e._.$instatxt2.use(2),e.runFilter(e._.$insta3,{filterStrength:r??1,map:{unit:1},mapLgg:{unit:2}})}else if(t.type==="4"){const n=`#version 300 es
        precision highp float;
        precision highp int;
        
        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform sampler2D map;
        uniform sampler2D map2;
        uniform float filterStrength;

        ${i}

        vec4 lut(vec4 color) {
          vec3 texel = color.rgb;
          texel = fromLinear(texel);
          texel.r = texture(map, vec2(texel.r, 0.5)).r;
          texel.g = texture(map, vec2(texel.g, 0.5)).g;
          texel.b = texture(map, vec2(texel.b, 0.5)).b;
          vec3 desat = vec3(dot(vec3(0.7, 0.2, 0.1), texel));
          texel = mix(texel, desat, 0.79);
          texel = vec3(min(1.0, 1.2 * dot(vec3(0.2, 0.7, 0.1), texel)));
          texel.r = texture(map2, vec2(texel.r, 0.5)).r;
          texel.g = texture(map2, vec2(texel.g, 0.5)).g;
          texel.b = texture(map2, vec2(texel.b, 0.5)).b;
          texel = toLinear(texel);
          return vec4(texel, color.a);
        }

        void main() {
          vec4 color = texture(_texture, texCoord);
          outColor = color * (1.0 - filterStrength) + lut(color) * filterStrength;
        }
    `;e._.$insta4=e._.$insta4||new V(o,null,n),e._.$instatxt1=e._.$instatxt1||new K(o,0,0,o.RGBA,o.UNSIGNED_BYTE),e._.$instatxt1.loadImage(t.map1,o.RGBA),e._.$instatxt2=e._.$instatxt2||new K(o,0,0,o.RGBA,o.UNSIGNED_BYTE),e._.$instatxt2.loadImage(t.map2,o.RGBA),e._.$instatxt1.use(1),e._.$instatxt2.use(2),e.runFilter(e._.$insta4,{filterStrength:r??1,map:{unit:1},map2:{unit:2}})}else if(t.type==="MTX"){const n=`#version 300 es
        precision highp float;
        precision highp int;
        
        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform float filterStrength;
        uniform mat4 uColorMatrix;
        uniform vec4 uColorOffset;

        vec4 applyColorMatrix(vec4 c, mat4 m, vec4 o) {
            vec4 res = (c * m) + (o * c.a);
            res = clamp(res, 0.0, 1.0);
            return res;
        }

        void main() {
          vec4 color = texture(_texture, texCoord);
          color = applyColorMatrix(color, uColorMatrix, uColorOffset);
          outColor = color;
        }
    `;let c={identity:[[1,0,0,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0]],polaroid:[[1+.438*r,-.062*r,-.062*r,0,0],[-.122*r,1+.378*r,-.122*r,0,0],[-.016*r,-.016*r,1+.483*r,0,0],[0,0,0,1,0]],kodachrome:[[(1+.1285582396593525*r)*((r/2+1)/2+.5),-.3967382283601348*r,-.03992559172921793*r,0,.06372958762196503*r],[-.16404339962244616*r,(1+.0835251566291304*r)*((r/2+1)/2+.5),-.05498805115633132*r,0,.024732407896706204*r],[-.16786010706155763*r,-.5603416277695248*r,(1+.6014850761964943*r)*((r/2+1)/2+.5),0,.03562982807460946*r],[0,0,0,1,0]],browni:[[(1-.4002976502*r)*((r/1.5+1)/2+.5),.34553243048391263*r,-.2708298674538042*r,0,.09486385711201746*r],[-.037703249837783157*r,(1-.1390422412*r)*((r/1.5+1)/2+.5),.15059552388459913*r,0,-.07393682996638255*r],[.24113635128153335*r,-.07441037908422492*r,(1-.5502781794*r)*((r/1.5+1)/2+.5),0,-.015124150555182566*r],[0,0,0,1,0]],vintage:[[(1-.3720654364*r)*((r/1.5+1)/2+.5),.3202183420819367*r,-.03965408211312453*r,0,.009651285835294123*r],[.02578397704808868*r,(1-.3558811356*r)*((r/1.5+1)/2+.5),.03259127616149294*r,0,.007462829176470591*r],[.0466055556782719*r,-.0851232987247891*r,(1-.4758351981*r)*((r/1.5+1)/2+.5),0,.005159190588235296*r],[0,0,0,1,0]]},a=c.identity,s=[0,0,0,0];r&&(a=Mr(a,c[t.mtx],4)),r&&(s=[0,1,2,3].map(l=>s[l]+c[t.mtx][l][4])),e._.$insta5=e._.$insta5||new V(o,null,n);const d=a.flat(),u=s;e.runFilter(e._.$insta5,{uColorMatrix:d,uColorOffset:u})}}function Mr(e,t,r=3){let o=[];for(var i=0;i<r;i++){o.push([]);for(var n=0;n<r;n++){o[i].push(0);for(var c=0;c<r;c++)e[i]&&t[c]&&(o[i][n]+=e[i][c]*t[c][n])}}return o}function Ne(e){var t=e.length;this.xa=[],this.ya=[],this.u=[],this.y2=[],e.sort(function(a,s){return a[0]-s[0]});for(var r=0;r<t;r++)this.xa.push(e[r][0]),this.ya.push(e[r][1]);this.u[0]=0,this.y2[0]=0;for(var r=1;r<t-1;++r){var o=this.xa[r+1]-this.xa[r-1],i=(this.xa[r]-this.xa[r-1])/o,n=i*this.y2[r-1]+2;this.y2[r]=(i-1)/n;var c=(this.ya[r+1]-this.ya[r])/(this.xa[r+1]-this.xa[r])-(this.ya[r]-this.ya[r-1])/(this.xa[r]-this.xa[r-1]);this.u[r]=(6*c/o-i*this.u[r-1])/n}this.y2[t-1]=0;for(var r=t-2;r>=0;--r)this.y2[r]=this.y2[r]*this.y2[r+1]+this.u[r]}Ne.prototype.at=function(e){for(var t=this.ya.length,r=0,o=t-1;o-r>1;){var i=o+r>>1;this.xa[i]>e?o=i:r=i}var n=this.xa[o]-this.xa[r],c=(this.xa[o]-e)/n,a=(e-this.xa[r])/n;return c*this.ya[r]+a*this.ya[o]+((c*c*c-c)*this.y2[r]+(a*a*a-a)*this.y2[o])*(n*n)/6};function Se(e){for(var t=new Ne(e),r=[],o=0;o<256;o++)r.push(Br(0,Math.floor(t.at(o/255)*256),255));return r}function Br(e,t,r){return Math.max(e,Math.min(t,r))}function Pr(e,t){if(t.every(s=>s===null))return;t[0]||(t[0]=[[0,0],[1,1]]);let r=t[1]||t[0],o=t[2]||t[0],i=t[3]||t[0];if(r=Se(r),o=Se(o),i=Se(i),r.length!==256||o.length!==256||i.length!==256)return console.error("curves: input unknown");for(var t=[],n=0;n<256;n++)t.splice(t.length,0,r[n],o[n],i[n],255);const c=`#version 300 es
        precision highp float;

        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform sampler2D curvemap;

        void main() {
            vec4 color = texture(_texture, texCoord);
            color.r = texture(curvemap, vec2(color.r)).r;
            color.g = texture(curvemap, vec2(color.g)).g;
            color.b = texture(curvemap, vec2(color.b)).b;
            outColor = color;
        }
      `,{gl:a}=e;e._.$curvestexture=e._.$curvestexture||new K(a),e._.$curvestexture.initFromBytes(256,1,t,a.RGBA),e._.$curvestexture.use(2),e._.$curves=e._.$curves||new V(a,null,c),e.runFilter(e._.$curves,{curvemap:{unit:2}})}function Rr(e,t,r,o){const i=`#version 300 es
            precision highp float;

            in vec2 texCoord;
            uniform sampler2D _texture;
            uniform vec2 uResolution;
            uniform mat3 matrix;
            uniform bool useTextureSpace;
            out vec4 outColor;

            void main() {
                vec2 coord = texCoord * uResolution;
                if (useTextureSpace) coord = coord / uResolution * 2.0 - 1.0;
                vec3 warp = matrix * vec3(coord, 1.0);
                coord = warp.xy / warp.z;
                if (useTextureSpace) coord = (coord * 0.5 + 0.5) * uResolution;
                vec4 color = texture(_texture, coord / uResolution);
                vec2 clampedCoord = clamp(coord, vec2(0.0), uResolution);
                if (coord != clampedCoord) {
                    //color.a *= max(0.0, 1.0 - length(coord - clampedCoord));
                    color.a = 0.;
                }
                outColor = color;
            }
          `,{gl:n,img:c}=e;if(e._.$warp=e._.$warp||new V(n,null,i),t=Array.prototype.concat.apply([],t),t.length==4)t=[t[0],t[1],0,t[2],t[3],0,0,0,1];else if(t.length!=9)throw"can only warp with 2x2 or 3x3 matrix";const a=[n.canvas.width,n.canvas.height];e.runFilter(e._.$warp,{matrix:r?Pt(t):t,uResolution:a,useTextureSpace:o|0})}function Lr(e,t,r,o,i){t=t.flat(),r=r.flat();var n=et.apply(null,r),c=et.apply(null,t),a=Ir(Pt(n),c);return Rr(e,a,o,i)}function et(e,t,r,o,i,n,c,a){var s=r-i,d=o-n,u=c-i,l=a-n,f=e-r+i-c,p=t-o+n-a,v=s*l-u*d,h=(f*l-u*p)/v,x=(s*p-f*d)/v;return[r-e+h*r,o-t+h*o,h,c-e+x*c,a-t+x*a,x,e,t,1]}function Pt(e){var t=e[0],r=e[1],o=e[2],i=e[3],n=e[4],c=e[5],a=e[6],s=e[7],d=e[8],u=t*n*d-t*c*s-r*i*d+r*c*a+o*i*s-o*n*a;return[(n*d-c*s)/u,(o*s-r*d)/u,(r*c-o*n)/u,(c*a-i*d)/u,(t*d-o*a)/u,(o*i-t*c)/u,(i*s-n*a)/u,(r*a-t*s)/u,(t*n-r*i)/u]}function Ir(e,t){return[e[0]*t[0]+e[1]*t[3]+e[2]*t[6],e[0]*t[1]+e[1]*t[4]+e[2]*t[7],e[0]*t[2]+e[1]*t[5]+e[2]*t[8],e[3]*t[0]+e[4]*t[3]+e[5]*t[6],e[3]*t[1]+e[4]*t[4]+e[5]*t[7],e[3]*t[2]+e[4]*t[5]+e[5]*t[8],e[6]*t[0]+e[7]*t[3]+e[8]*t[6],e[6]*t[1]+e[7]*t[4]+e[8]*t[7],e[6]*t[2]+e[7]*t[5]+e[8]*t[8]]}function Tr(e,t,r){const{gl:o}=e,i=`#version 300 es
        precision highp float;

        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform sampler2D map;
        uniform float filterStrength;

        vec4 fromLinear(vec4 linearRGB) {
            bvec3 cutoff = lessThan(linearRGB.rgb, vec3(0.0031308));
            vec3 higher = vec3(1.055)*pow(linearRGB.rgb, vec3(1.0/2.4)) - vec3(0.055);
            vec3 lower = linearRGB.rgb * vec3(12.92);
            return vec4(mix(higher, lower, cutoff), linearRGB.a);
        }
        vec4 toLinear(vec4 sRGB) {
            bvec3 cutoff = lessThan(sRGB.rgb, vec3(0.04045));
            vec3 higher = pow((sRGB.rgb + vec3(0.055))/vec3(1.055), vec3(2.4));
            vec3 lower = sRGB.rgb/vec3(12.92);
            return vec4(mix(higher, lower, cutoff), sRGB.a);
        }

        void main(){
          vec4 color = texture(_texture, texCoord);
          vec4 texc = texture(map, texCoord);
          color = toLinear(color);
          texc = toLinear(texc);
          color = mix(color, texc, filterStrength);
          color = fromLinear(color);
          outColor = color;
        }`;e._.$blend=e._.$blend||new V(o,null,i),e._.$blendtxt=e._.$blendtxt||new K(o),e._.$blendtxt.loadImage(t),e._.$blendtxt.use(1),e.runFilter(e._.$blend,{filterStrength:r??1,map:{unit:1}})}function Fr(e,t){const r=`#version 300 es
        //Bokeh disc. by David Hoskins.
        //https://www.shadertoy.com/view/4d2Xzw
        precision highp float;

        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform float bokehstrength;
        uniform float bokehlensin;
        uniform float bokehlensout;
        uniform float centerX;
        uniform float centerY;

        #define GOLDEN_ANGLE 2.39996323
        #define ITERATIONS 512
        const mat2 rot = mat2(cos(GOLDEN_ANGLE), sin(GOLDEN_ANGLE), -sin(GOLDEN_ANGLE), cos(GOLDEN_ANGLE));
        vec3 Bokeh(sampler2D tex, vec2 uv, float radius)
        {
          vec3 acc = vec3(0), div = acc;
            float r = 1.;
            vec2 vangle = vec2(0.0,radius*.01 / sqrt(float(ITERATIONS)));
            
          for (int j = 0; j < ITERATIONS; j++)
            {  
                // the approx increase in the scale of sqrt(0, 1, 2, 3...)
                r += 1. / r;
              vangle = rot * vangle;
                vec3 col = texture(tex, uv + (r-1.) * vangle).xyz; /// ... Sample the image
                //col = col * col *1.8; // ... Contrast it for better highlights - leave this out elsewhere.
            vec3 bokeh = pow(col, vec3(4));
            acc += col * bokeh;
            div += bokeh;
          }
          return acc / div;
        }


        void main() {
            vec4 color = texture(_texture, texCoord);
            vec4 bcolor = vec4(Bokeh(_texture, texCoord, bokehstrength), 1.);
    
            //vignette used to control alpha
            //to blur inside circle smoothstep(lensin, lensout, dist)
            //to blur outside circle smoothstep(lensout, lensin, dist)
            float dist = distance(texCoord.xy, vec2(centerX,centerY));
            float vigfin = pow(1.-smoothstep(max(0.001,bokehlensout), bokehlensin, dist),2.);

            outColor = mix( color, bcolor, vigfin);
        }
      `,{gl:o}=e;let{bokehstrength:i=.5,bokehlensin:n=0,bokehlensout:c=.5,centerX:a=0,centerY:s=0}=t||{};e._.$lensblur=e._.$lensblur||new V(o,null,r),e.runFilter(e._.$lensblur,{bokehstrength:i,bokehlensin:n,bokehlensout:c,centerX:a,centerY:s})}function Dr(e,t){const r=`#version 300 es
        //https://www.shadertoy.com/view/XdfGDH
        precision highp float;

        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform vec2 uResolution;
        uniform float gaussianstrength;
        uniform float gaussianlensin;
        uniform float gaussianlensout;
        uniform float centerX;
        uniform float centerY;

        float normpdf(in float x, in float sigma)
        {
          return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;
        }

        void main() {
            vec4 color = texture(_texture, texCoord);

            //declare stuff
            const int mSize = 11;
            const int kSize = (mSize-1)/2;
            float kernel[mSize];
            vec3 final_colour = vec3(0.0);
            
            //create the 1-D kernel
            float sigma = 7.0*gaussianstrength;
            float Z = 0.0;
            for (int j = 0; j <= kSize; ++j)
            {
              kernel[kSize+j] = kernel[kSize-j] = normpdf(float(j), sigma);
            }
            
            //get the normalization factor (as the gaussian has been clamped)
            for (int j = 0; j < mSize; ++j)
            {
              Z += kernel[j];
            }
            
            //read out the texels
            for (int i=-kSize; i <= kSize; ++i)
            {
              for (int j=-kSize; j <= kSize; ++j)
              {
                final_colour += kernel[kSize+j]*kernel[kSize+i]*texture(_texture, (texCoord.xy+vec2(float(i),float(j))/uResolution)).rgb;
              }
            }
            
            //vignette used to control alpha
            //to blur inside circle smoothstep(lensin, lensout, dist)
            //to blur outside circle smoothstep(lensout, lensin, dist)
            float dist = distance(texCoord.xy, vec2(centerX,centerY));
            float vigfin = pow(1.-smoothstep(max(0.001,gaussianlensout), gaussianlensin, dist),2.);

            outColor = mix( color, vec4(final_colour/(Z*Z), 1.0), vigfin);
        }
      `,{gl:o}=e;let{gaussianstrength:i=.5,gaussianlensin:n=0,gaussianlensout:c=.5,centerX:a=0,centerY:s=0}=t||{};const d=[o.canvas.width,o.canvas.height];e._.$gaussianblur=e._.$gaussianblur||new V(o,null,r),e.runFilter(e._.$gaussianblur,{gaussianstrength:i,gaussianlensin:n,gaussianlensout:c,centerX:a,centerY:s,uResolution:d})}function zr(e,t){const r=`#version 300 es
        precision highp float;

        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform vec2 uTextureSize;
        uniform mat4 uColorMatrix;
        uniform vec4 uColorOffset;
        uniform float uClarityKernel[9];
        uniform float uClarityKernelWeight;
        uniform float uColorGamma;
        uniform float uVibrance;
        uniform float uColorVignette;
        uniform vec2 uVignettePos;
        uniform float vibrance;

        vec4 applyGamma(vec4 c, float g) {
            c.r = pow(c.r, g);
            c.g = pow(c.g, g);
            c.b = pow(c.b, g);
            return c;
        }
        vec4 applyVibrance(vec4 c, float v){
          float max = max(c.r, max(c.g, c.b));
          float avg = (c.r + c.g + c.b) / 3.0;
          float amt = (abs(max - avg) * 2.0) * -v;
          c.r += max != c.r ? (max - c.r) * amt : 0.00;
          c.g += max != c.g ? (max - c.g) * amt : 0.00;
          c.b += max != c.b ? (max - c.b) * amt : 0.00;
          return c;
        }
        vec4 applyColorMatrix(vec4 c, mat4 m, vec4 o) {
            vec4 res = (c * m) + (o * c.a);
            res = clamp(res, 0.0, 1.0);
            return res;
        }
        vec4 applyConvolutionMatrix(vec4 c, float k0, float k1, float k2, float k3, float k4, float k5, float k6, float k7, float k8, float w) {
          vec2 pixel = vec2(1) / uTextureSize;
          vec4 colorSum = texture(_texture, texCoord - pixel) * k0 + texture(_texture, texCoord + pixel * vec2(0.0, -1.0)) * k1 + texture(_texture, texCoord + pixel * vec2(1.0, -1.0)) * k2 + texture(_texture, texCoord + pixel * vec2(-1.0, 0.0)) * k3 + texture(_texture, texCoord) * k4 + texture(_texture, texCoord + pixel * vec2(1.0, 0.0)) * k5 + texture(_texture, texCoord + pixel * vec2(-1.0, 1.0)) * k6 + texture(_texture, texCoord + pixel * vec2(0.0, 1.0)) * k7 + texture(_texture, texCoord + pixel) * k8;
          vec4 color = vec4(clamp((colorSum / w), 0.0, 1.0).rgb, c.a);
          return color;
        }

        vec4 applyVignette2(vec4 c, vec2 pos, float v, vec2 upos){
          #define inner .20
          #define outer 1.1
          #define curvature .65
          vec2 curve = pow(abs(pos),vec2(1./curvature));
          float edge = pow(length(curve),curvature);
          float scale = 1.-abs(upos.x);
          float vignette = 1.-v*smoothstep(inner*scale,outer*scale,edge);
          vec4 color = vec4(c.rgb *= vignette , c.a);
          return color;
        }

        vec4 vignette3(vec4 c, vec2 pos, float radius)
        {
            float ambientlight = 0.14;
            float circle = length(pos) - radius;
            float v = 1.0 - smoothstep(0.0, 0.4f, circle) + ambientlight;
            return vec4(c.rgb*v,c.a);
        }

        void main() {
          vec4 color = texture(_texture, texCoord);
          if (uClarityKernelWeight != -1.0) { 
            color = applyConvolutionMatrix(color, uClarityKernel[0], uClarityKernel[1], uClarityKernel[2], uClarityKernel[3], uClarityKernel[4], uClarityKernel[5], uClarityKernel[6], uClarityKernel[7], uClarityKernel[8], uClarityKernelWeight); 
          } 
          color = applyGamma(color, uColorGamma);
          color = applyVibrance(color, uVibrance);
          color = applyColorMatrix(color, uColorMatrix, uColorOffset);
          if (uColorVignette != 0.0) {
            vec2 pos = texCoord.xy*2.-1. - uVignettePos;
            //color = vignette3(color, pos, uColorVignette);
            color = applyVignette2(color, pos, uColorVignette, uVignettePos);
          }
          outColor = color;
        }
      `,{gl:o}=e;let i=[0,0],{brightness:n=0,contrast:c=0,saturation:a=0,exposure:s=0,temperature:d=0,gamma:u=0,clarity:l=0,vibrance:f=0,vignette:p=0,tint:v=0,sepia:h=0}=t;n=n/4,c=(c+1)/2+.5,a=a+1,s=((s>0?s*3:s*1.5)+1)/2+.5,u+=1,d*=2,v*=2;let x={brightness:[[1,0,0,0,n],[0,1,0,0,n],[0,0,1,0,n],[0,0,0,1,0]],contrast:[[c,0,0,0,.5*(1-c)],[0,c,0,0,.5*(1-c)],[0,0,c,0,.5*(1-c)],[0,0,0,1,0]],saturation:[[.213+.787*a,.715-.715*a,.072-.072*a,0,0],[.213-.213*a,.715+.285*a,.072-.072*a,0,0],[.213-.213*a,.715-.715*a,.072+.928*a,0,0],[0,0,0,1,0]],exposure:[[s,0,0,0,0],[0,s,0,0,0],[0,0,s,0,0],[0,0,0,1,0]],temperature:d>0?[[1+.1*d,0,0,0,0],[0,1,0,0,0],[0,0,1+.1*-d,0,0],[0,0,0,1,0]]:[[1+.15*d,0,0,0,0],[0,1+.05*d,0,0,0],[0,0,1+.15*-d,0,0],[0,0,0,1,0]],tint:[[1,0,0,0,0],[0,1+.1*v,0,0,0],[0,0,1,0,0],[0,0,0,1,0]],sepia:[[1-.607*h,.769*h,.189*h,0,0],[.349*h,1-.314*h,.168*h,0,0],[.272*h,.534*h,1-.869*h,0,0],[0,0,0,1,0]],identity:[[1,0,0,0,0],[0,1,0,0,0],[0,0,1,0,0],[0,0,0,1,0]]},w=x.identity,_=[0,0,0,0];w=le(w,x.brightness,4),_=[0,1,2,3].map(R=>_[R]+x.brightness[R][4]),w=le(w,x.contrast,4),_=[0,1,2,3].map(R=>_[R]+x.contrast[R][4]),w=le(w,x.saturation,4),w=le(w,x.exposure,4),w=le(w,x.temperature,4),w=le(w,x.tint,4),w=le(w,x.sepia,4);let E=l>=0?[0,-1*l,0,-1*l,1+4*l,-1*l,0,-1*l,0]:[-1*l,-2*l,-1*l,-2*l,1+-3*l,-2*l,-1*l,-2*l,-1*l],m=E.reduce(((R,P)=>R+P),0);m=m<=0?1:m,E=[E];const M=w.flat(),g=_,b=[o.canvas.width,o.canvas.height],B=f,S=p,C=E,y=m,T=i;e._.$adj=e._.$adj||new V(o,null,r),e.runFilter(e._.$adj,{uColorMatrix:M,uColorOffset:g,uColorGamma:1/u,uClarityKernel:C,uClarityKernelWeight:y,uTextureSize:b,uVibrance:B,uColorVignette:S,uVignettePos:T})}function Ur(e,t,r){const o=`#version 300 es
        precision highp float;

        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform float shadows;
        uniform float highlights;

        const mediump vec3 luminanceWeighting = vec3(0.2125, 0.7154, 0.0721);

        void main() {
          vec4 color = texture(_texture, texCoord);

          float luminance = dot(color.rgb, luminanceWeighting);
          float shadow = clamp((pow(luminance, 1.0/shadows) + (-0.76)*pow(luminance, 2.0/shadows)) - luminance, 0.0, 1.0);
          float highlight = clamp((1.0 - (pow(1.0-luminance, 1.0/(2.0-highlights)) + (-0.8)*pow(1.0-luminance, 2.0/(2.0-highlights)))) - luminance, -1.0, 0.0);
          vec3 result = vec3(0.0, 0.0, 0.0) + (luminance + shadow + highlight) * ((color.rgb - vec3(0.0, 0.0, 0.0))/luminance );

          // blend toward white if highlights is more than 1
          float contrastedLuminance = ((luminance - 0.5) * 1.5) + 0.5;
          float whiteInterp = contrastedLuminance*contrastedLuminance*contrastedLuminance;
          float whiteTarget = clamp(highlights, 0.0, 2.0) - 1.0;
          result = mix(result, vec3(1.0), whiteInterp*whiteTarget);

          // blend toward black if shadows is less than 1
          float invContrastedLuminance = 1.0 - contrastedLuminance;
          float blackInterp = invContrastedLuminance*invContrastedLuminance*invContrastedLuminance;
          float blackTarget = 1.0 - clamp(shadows, 0.0, 1.0);
          result = mix(result, vec3(0.0), blackInterp*blackTarget);

          outColor = vec4(result, color.a);
        }
  `,{gl:i}=e;e._.$sg=e._.$sg||new V(i,null,o),e.runFilter(e._.$sg,{highlights:t+1,shadows:r/2+1})}function Gr(e,t){const r=`#version 300 es
        precision highp float;

        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform vec2 uResolution;
        uniform float filterStrength;


        vec4 BlurColor (in vec2 Coord, in sampler2D Tex, in float MipBias)
        {
            vec2 TexelSize = MipBias/uResolution.xy;
            vec4  Color = texture(Tex, Coord, MipBias);
            Color += texture(Tex, Coord + vec2(TexelSize.x,0.0), MipBias);      
            Color += texture(Tex, Coord + vec2(-TexelSize.x,0.0), MipBias);     
            Color += texture(Tex, Coord + vec2(0.0,TexelSize.y), MipBias);      
            Color += texture(Tex, Coord + vec2(0.0,-TexelSize.y), MipBias);     
            Color += texture(Tex, Coord + vec2(TexelSize.x,TexelSize.y), MipBias);      
            Color += texture(Tex, Coord + vec2(-TexelSize.x,TexelSize.y), MipBias);     
            Color += texture(Tex, Coord + vec2(TexelSize.x,-TexelSize.y), MipBias);     
            Color += texture(Tex, Coord + vec2(-TexelSize.x,-TexelSize.y), MipBias);    
            return Color/9.0;
        }

        void main() {
          float Threshold = 0.4;
          float Intensity = filterStrength*1.0;
          float BlurSize = 3.0 * Intensity;

          vec4 color = texture(_texture, texCoord);
          vec4 Highlight = clamp(BlurColor(texCoord.xy, _texture, BlurSize)-Threshold,0.0,1.0)*1.0/(1.0-Threshold);
          outColor = 1.0-(1.0-color)*(1.0-Highlight*Intensity); //Screen Blend Mode
        }
  `,{gl:o}=e,i=[o.canvas.width,o.canvas.height];e._.$bloom=e._.$bloom||new V(o,null,r),e.runFilter(e._.$bloom,{filterStrength:t,uResolution:i})}function Or(e,t){const r=`#version 300 es
        precision highp float;

        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        uniform vec2 uResolution;
        uniform float filterStrength;

        #define SIGMA 10.0
        #define BSIGMA 0.1
        #define MSIZE 15

        float normpdf(in float x, in float sigma)
        {
          return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;
        }

        float normpdf3(in vec3 v, in float sigma)
        {
          return 0.39894*exp(-0.5*dot(v,v)/(sigma*sigma))/sigma;
        }

        vec4 applyFilter(vec4 c, sampler2D _texture, vec2 texCoord) {

          const int kSize = (MSIZE-1)/2;
          float kernel[MSIZE] = float[MSIZE](0.031225216, 0.033322271, 0.035206333, 0.036826804, 0.038138565, 0.039104044, 0.039695028, 0.039894000, 0.039695028, 0.039104044, 0.038138565, 0.036826804, 0.035206333, 0.033322271, 0.031225216);
          vec3 final_colour = vec3(0.0);
          
          vec3 cc;
          float factor;
          float Z = 0.0;
          float bZ = 1.0/normpdf(0.0, BSIGMA);
          for (int i=-kSize; i <= kSize; ++i)
          {
            for (int j=-kSize; j <= kSize; ++j)
            {
              cc = texture(_texture, (texCoord.xy+vec2(float(i),float(j))/uResolution)).rgb;
              factor = normpdf3(cc-c.rgb, BSIGMA)*bZ*kernel[kSize+j]*kernel[kSize+i];
              Z += factor;
              final_colour += factor*cc;
            }
          }
          
          return vec4(final_colour/Z, 1.0);
        }

        void main() {
          vec4 color = texture(_texture, texCoord);
          color = color * (1.0 - filterStrength) + applyFilter(color, _texture, texCoord) * filterStrength;
          outColor = color;
        }
  `,{gl:o}=e,i=[o.canvas.width,o.canvas.height];e._.$noise=e._.$noise||new V(o,null,r),e.runFilter(e._.$noise,{filterStrength:t,uResolution:i})}function le(e,t,r=3){let o=[];for(var i=0;i<r;i++){o.push([]);for(var n=0;n<r;n++){o[i].push(0);for(var c=0;c<r;c++)e[i]&&t[c]&&(o[i][n]+=e[i][c]*t[c][n])}}return o}const tt=Object.freeze(Object.defineProperty({__proto__:null,filterAdjustments:zr,filterBlend:Tr,filterBloom:Gr,filterBlurBokeh:Fr,filterBlurGaussian:Dr,filterCurves:Pr,filterHighlightsShadows:Ur,filterInsta:Ar,filterMatrix:Er,filterNoise:Or,filterPerspective:Lr},Symbol.toStringTag,{value:"Module"}));function Nr(e,t,r){let o=e.getContext("webgl2",{antialias:!1,premultipliedAlpha:!0});if(!o)return console.error("webgl2 not supported!");r==="display-p3"?(o.drawingBufferColorSpace="display-p3",o.unpackColorSpace="display-p3"):(o.drawingBufferColorSpace="srgb",o.unpackColorSpace="srgb");const i={width:0,height:0,gl:o,img:t,destroy:l,loadImage:v,paintCanvas:h,crop:M,resetCrop:g,resize:w,resetResize:_,captureImage:b,readPixels:B,runFilter:p,setupFiltersTextures:u,_:{}};o.canvas.width=i.width=t.naturalWidth,o.canvas.height=i.height=t.naturalHeight;const n=new K(o);n.loadImage(t);const c=new V(o),a=new V(o,null,Vr);let s,d=0;function u(){s?.length&&s.forEach(y=>y.destroy()),s=[];for(var C=0;C<2;++C){const y=new K(o,o.canvas.width,o.canvas.height);s.push(y)}}u();function l(){s?.length&&s.forEach(C=>C.destroy()),E&&E.destroy(),n.destroy(),delete i.img_cropped}let f;function p(C,y){y&&C.uniforms(y),f&&f.use(),s[d%2].drawTo(),C.drawRect(),f=s[d%2],d++}function v(){E?f=E:f=n,p(c,null)}function h(){f&&f.use(),o.bindFramebuffer(o.FRAMEBUFFER,null),a.drawRect()}let x={width:0,height:0};function w(C,y){o.canvas.width=i.width=x.width=C,o.canvas.height=i.height=x.height=y,u()}function _(){x.width&&(x.width=x.height=0,o.canvas.width=i.width=m.width||t.naturalWidth,o.canvas.height=i.height=m.height||t.naturalHeight,u())}let E,m={width:0,height:0};function M({left:C,top:y,width:T,height:R}){const P=T*R*4,A=new Uint8Array(P);p(c,{}),o.readPixels(C,y,T,R,o.RGBA,o.UNSIGNED_BYTE,A);const L=o.unpackColorSpace,U=new ImageData(new Uint8ClampedArray(A.buffer),T,R,{colorSpace:L});E=new K(o),E.loadImage(U),o.canvas.width=i.width=m.width=T,o.canvas.height=i.height=m.height=R,u(),i.img_cropped=rt(U,L)}function g(){E&&(E.destroy(),E=null,m.width=m.height=0,o.canvas.width=i.width=x.width||t.naturalWidth,o.canvas.height=i.height=x.height||t.naturalHeight,delete i.img_cropped,u())}function b(C,y){p(c,{});const{width:T,height:R}=o.canvas,P=T*R*4,A=new Uint8Array(P);o.readPixels(0,0,T,R,o.RGBA,o.UNSIGNED_BYTE,A);const L=o.unpackColorSpace,U=new ImageData(new Uint8ClampedArray(A.buffer),T,R,{colorSpace:L});return rt(U,L,C,y)}function B(){p(c,{});const{width:C,height:y}=o.canvas,T=C*y*4,R=new Uint8Array(T);return o.readPixels(0,0,C,y,o.RGBA,o.UNSIGNED_BYTE,R),R}function S(C){return function(...y){C(i,...y)}}return Object.keys(tt).forEach(C=>i[C]=S(tt[C])),i}const Vr=`#version 300 es
        precision highp float;
        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;

        vec4 fromLinear(vec4 linearRGB) {
            bvec3 cutoff = lessThan(linearRGB.rgb, vec3(0.0031308));
            vec3 higher = vec3(1.055)*pow(linearRGB.rgb, vec3(1.0/2.4)) - vec3(0.055);
            vec3 lower = linearRGB.rgb * vec3(12.92);
            return vec4(mix(higher, lower, cutoff), linearRGB.a);
        }

        void main() {
            vec4 color = texture(_texture, vec2(texCoord.x, 1.0 - texCoord.y));
            //outColor = color;
            outColor = fromLinear(color);
        }`;function V(e,t,r){const o=`#version 300 es
        in vec2 vertex;
        out vec2 texCoord;

        void main() {
          texCoord = vertex;
          gl_Position = vec4(vertex * 2.0 - 1.0, 0.0, 1.0);
        }
      `,i=`#version 300 es
        precision highp float;

        in vec2 texCoord;
        uniform sampler2D _texture;
        out vec4 outColor;   

        void main() {
          outColor = texture(_texture, texCoord);
        }
      `,n=e.createProgram();let c;e.attachShader(n,d(e,e.VERTEX_SHADER,t||o)),e.attachShader(n,d(e,e.FRAGMENT_SHADER,r||i)),e.linkProgram(n);function a(u=!0,l,f,p,v){const h=e.getParameter(e.VIEWPORT);l=l!==void 0?(l-h[0])/h[2]:0,f=f!==void 0?(f-h[1])/h[3]:0,p=p!==void 0?(p-h[0])/h[2]:1,v=v!==void 0?(v-h[1])/h[3]:1,e.useProgram(n),e.vertexBuffer=e.vertexBuffer||e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,e.vertexBuffer),e.bufferData(e.ARRAY_BUFFER,new Float32Array([l,f,l,v,p,f,p,v]),e.STATIC_DRAW),c||(c=e.getAttribLocation(n,"vertex"),e.enableVertexAttribArray(c)),e.vertexAttribPointer(c,2,e.FLOAT,!1,0,0),u&&(e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT|e.GL_DEPTH_BUFFER_BIT)),e.drawArrays(e.TRIANGLE_STRIP,0,4)}function s(u={}){e.useProgram(n);for(let l in u){const f=e.getUniformLocation(n,l);if(f===null)continue;let p=u[l];if(Array.isArray(p))switch(p.length){case 1:{Array.isArray(p[0])&&(p=p[0]),e.uniform1fv(f,new Float32Array(p));break}case 2:e.uniform2fv(f,new Float32Array(p));break;case 3:e.uniform3fv(f,new Float32Array(p));break;case 4:e.uniform4fv(f,new Float32Array(p));break;case 9:e.uniformMatrix3fv(f,!1,new Float32Array(p));break;case 16:e.uniformMatrix4fv(f,!1,new Float32Array(p));break;default:throw`dont't know how to load uniform "`+l+'" of length '+p.length}else if(p?.unit)e.uniform1i(f,p.unit);else if(typeof p=="number")e.uniform1f(f,p);else throw'attempted to set uniform "'+l+'" to invalid value '+(p||"undefined").toString()}}function d(u,l,f){var p=u.createShader(l);if(u.shaderSource(p,f),u.compileShader(p),!u.getShaderParameter(p,u.COMPILE_STATUS))throw"compile error: "+u.getShaderInfoLog(p);return p}return{drawRect:a,uniforms:s}}function K(e,t,r){let o=t,i=r,n=e.createTexture();e.bindTexture(e.TEXTURE_2D,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);const c=e.SRGB8_ALPHA8;t&&r&&e.texImage2D(e.TEXTURE_2D,0,c,t,r,0,e.RGBA,e.UNSIGNED_BYTE,null);function a(f=0){if(!n)return console.error("texture has been destroyed");e.activeTexture(e.TEXTURE0+f),e.bindTexture(e.TEXTURE_2D,n)}function s(){e.deleteTexture(n),n=null}function d(){if(!n)return console.error("texture has been destroyed");if(e.framebuffer=e.framebuffer||e.createFramebuffer(),e.bindFramebuffer(e.FRAMEBUFFER,e.framebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,n,0),e.checkFramebufferStatus(e.FRAMEBUFFER)!==e.FRAMEBUFFER_COMPLETE)throw new Error("incomplete framebuffer");e.viewport(0,0,o,i)}function u(f,p){if(!n)return console.error("texture has been destroyed");o=f.naturalWidth,i=f.naturalHeight,e.bindTexture(e.TEXTURE_2D,n);let v=p||e.SRGB8_ALPHA8;e.texImage2D(e.TEXTURE_2D,0,v,e.RGBA,e.UNSIGNED_BYTE,f)}function l(f,p,v,h){o=f,i=p,e.bindTexture(e.TEXTURE_2D,n);let x=h||e.SRGB8_ALPHA8;e.texImage2D(e.TEXTURE_2D,0,x,f,p,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array(v))}return{use:a,destroy:s,drawTo:d,loadImage:u,initFromBytes:l}}function rt(e,t,r,o){const i=document.createElement("canvas");var n=i.getContext("2d",{colorSpace:t});i.width=e.width,i.height=e.height,n.putImageData(e,0,0);var c=new Image;return c.src=i.toDataURL(r,o),c}const it="./assets/icon-BgvqB1Sr.png",ot="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAAXVBMVEVHcEz////19fb////////////////7+/z////8/f3///////////////8kKS////8AAAYQFx4cISgCCxXp6eo8QEWTlZimqKq4ubrb3N3Oz9BjZmlsb3J5fH9SV1ti3zuCAAAADnRSTlMAjOkVW5+z7zfPDGEUCtxuPFoAAAFVSURBVCiRdZPbksIgDIapOlJ0hSScofj+j7mBVmud3Vx0MnyTP8cKsdltnpQ0Rqppvomjne/KlbA8n0ssTt3Pn2y+5ugBLKIF8Clf551dZPKAejNkLC87i/hGA1N80ZkZWUsv1H2Mcij/XBMStoVTAoxPa0iUrj9dNHsONMa1GmIMtTljONRnFn6oBBq1OZgmDUk9xOw8aoIjBNL4dLOYCnu2HmG1XFaehIrQnSPMXDtEJeRiNXrzZZzKNinME1n/i8n+WM0K/4rssMsSuSNzRENWBdDc1BGm/sYFcStaW38IXVsv0xiCJ1jKzgq3yXXwEB7caM0NfAuj2Rya7/tj1QcPvmgIRvM+RnDBsbx18H1lFoqpPsiRb+lxhOvKxHwKsPcyIGE4bWd0YepDTO9IsuG0H9GJlaG6FVqgtLN+miXAssJqQ/k8zXHUeUub89dR//M7/AKcSin3jX0wmQAAAABJRU5ErkJggg==",Xr='<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g><path d="M43 21v23.873h-8.604V35L20 50l14.396 15v-9.877H43V79h4.5V21H43zm9.5 0v58H57V55.125h8.605v9.873L80 50L65.605 35.004v9.869H57V21h-4.5z"></path></g></svg>',Hr=`<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">\r
<path fill-rule="evenodd" clip-rule="evenodd" d="M12 6C12 5.44772 11.5523 5 11 5C10.4477 5 10 5.44772 10 6V16C10 16.5523 10.4477 17 11 17C11.5523 17 12 16.5523 12 16V6ZM9 9C9 8.44772 8.55228 8 8 8C7.44772 8 7 8.44772 7 9V16C7 16.5523 7.44772 17 8 17C8.55228 17 9 16.5523 9 16V9ZM15 9C15 8.44772 14.5523 8 14 8C13.4477 8 13 8.44772 13 9V16C13 16.5523 13.4477 17 14 17C14.5523 17 15 16.5523 15 16V9ZM18 13C18 12.4477 17.5523 12 17 12C16.4477 12 16 12.4477 16 13V16C16 16.5523 16.4477 17 17 17C17.5523 17 18 16.5523 18 16V13ZM6 15C6 14.4477 5.55228 14 5 14C4.44772 14 4 14.4477 4 15V16C4 16.5523 4.44772 17 5 17C5.55228 17 6 16.5523 6 16V15ZM21 15C21 14.4477 20.5523 14 20 14C19.4477 14 19 14.4477 19 15V16C19 16.5523 19.4477 17 20 17C20.5523 17 21 16.5523 21 16V15ZM4 18C3.44772 18 3 18.4477 3 19C3 19.5523 3.44772 20 4 20H21C21.5523 20 22 19.5523 22 19C22 18.4477 21.5523 18 21 18H4Z"/>\r
</svg>`,jr=`<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">\r
  <path d="M10 3a7 7 0 100 14 7 7 0 000-14zm-9 7a9 9 0 1118 0 9 9 0 01-18 0zm8-4a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm.01 8a1 1 0 102 0V9a1 1 0 10-2 0v5z"/>\r
</svg>`;function Re({el:e,onStart:t,onMove:r,onEnd:o,onZoom:i,onPinch:n,disableleave:c=!1}){const a=[];let s=0,d,u,l=!0;const f=m=>{a.push(m),t&&t({el:e,ev:m}),d=m.clientX,u=m.clientY,l=!0},p=m=>{if(!a.length)return;const M=a.findIndex(g=>g.pointerId===m.pointerId);a.splice(M,1),o&&o({el:e,ev:m})},v=m=>{if(!a.length)return;const M=a.findIndex(g=>g.pointerId===m.pointerId);if(a[M]=m,a.length===1)r&&r({el:e,ev:m,x:m.clientX-d,y:m.clientY-u}),d=m.clientX,u=m.clientY;else if(a.length===2){const g=Math.abs(a[0].x-a[1].x);if(s>0){let b=g-s;l&&(l=!1,b*=-1),m.preventDefault(),n&&n({el:e,ev0:a[0],ev1:a[1],diff:b})}s=g}},h=m=>{m.touches.length===2&&m.preventDefault()},x=m=>{f(m)},w=m=>v(m),_=m=>{p(m)},E=m=>i&&i({el:e,ev:m,zoom:m.deltaY/100});return e.addEventListener("pointerdown",x),e.addEventListener("pointermove",w),e.addEventListener("pointerup",_),c||(e.addEventListener("pointercancel",_),e.addEventListener("pointerout",_)),e.addEventListener("pointerleave",_),e.addEventListener("touchstart",h),i&&e.addEventListener("wheel",E,{passive:!1}),()=>{e.removeEventListener("pointerdown",x),e.removeEventListener("pointermove",w),e.removeEventListener("pointerup",_),c||(e.removeEventListener("pointercancel",_),e.removeEventListener("pointerout",_)),e.removeEventListener("pointerleave",_),e.removeEventListener("touchstart",h),i&&e.removeEventListener("wheel",E)}}function nt(e,t,r,o,i,n){e.style.transformOrigin||(e.style.transformOrigin="0 0");let c=e.style.transform.match(/translate\((.*?)\)/)?.[1].split(",").map(u=>parseFloat(u))||[0,0],a=e.style.transform.match(/scale\((.*?)\)/)?.[1].split(",").map(u=>parseFloat(u))[0]||1;var s={x:0,y:0},d={x:0,y:0};d.x=t.x-e.parentElement.offsetLeft,d.y=t.y-e.parentElement.offsetTop,r=Math.max(-1,Math.min(1,r/10)),r&&(s.x=(d.x-c[0])/a,s.y=(d.y-c[1])/a,a+=r*o*a,a=Math.max(i,Math.min(n,a)),c[0]=-s.x*a+d.x,c[1]=-s.y*a+d.y,e.style.transform="translate("+c[0]+"px,"+c[1]+"px) scale("+a+","+a+")")}function at(e,t){const r=Re({el:t,onMove:i=>{const n=document.elementFromPoint(i.ev.pageX,i.ev.pageY);if(n===e||n===t)return;const c=i.el.style.transform.match(/translate\((.*?)\)/)?.[1].split(",").map(s=>parseFloat(s))||[0,0],a=i.el.parentElement.style.transform.match(/scale\((.*?)\)/)?.[1].split(",").map(s=>parseFloat(s))[0]||1;c[0]+=i.x/a,c[1]+=i.y/a,i.el.style.transform=`translate(${c[0]}px,${c[1]}px)`}}),o=Re({el:e,onZoom:i=>{const n=i.ev;n.preventDefault();const c={x:n.pageX,y:n.pageY},a=document.elementFromPoint(c.x,c.y);if(!(a===e||a===t)){var s=n.wheelDelta||n.detail;nt(i.el,c,s,.06,.9,8)}},onPinch:i=>{const n=i.ev0,c=i.ev1,a={x:(n.pageX+c.pageX)/2,y:(n.pageY+c.pageY)/2},s=document.elementFromPoint(a.x,a.y);if(!(s===e||s===t)){var d=i.diff;nt(i.el,a,d,.05*2,.9,8)}}});return()=>{r(),o()}}const Ee=new Map;function me(e,t,r=100){if(!Ee.has(e)){const o=setTimeout(()=>{t(),Ee.delete(e)},r);Ee.set(e,o)}}async function Rt(e){let t=document.createElement("input");try{t.setAttribute("hidden",""),t.type="file",t.value=null,e&&(t.accept=e),document.body.appendChild(t);const r=await new Promise(i=>{t.onchange=i,t.oncancel=i,t.click()});if(t.remove(),r.type==="cancel")return;const o=r.target.files[0];return o||await se("Unsupported file format!")}catch(r){await se("Error opening file"),console.error(r)}}function Wr(e,t){if(!e||!t)return console.error("download missing inputs");try{var r=document.createElement("a");r.href=URL.createObjectURL(e),r.download=t,r.click()}catch(o){console.error(o)}}async function Le(e,t=null){try{if(!e)return;const r=new FileReader;await new Promise(d=>r.onload=d,r.readAsArrayBuffer(e));const{name:o,size:i,type:n,lastModified:c}=e,a=new Blob([r.result],{type:n}),s=new Image;s.src=URL.createObjectURL(a),await s.decode(),t&&t(r.result,{name:o,size:i,type:n,lastModified:c},s)}catch(r){console.error(r),await se("Unknown format")}}function Yr(e){var t=-1,r=[" kB"," MB"," GB"," TB","PB","EB","ZB","YB"];do e/=1024,t++;while(e>1024);return Math.max(e,.1).toFixed(1)+r[t]}const Zr=async(e,t)=>{const r={files:[new File([t],e,{type:t.type})]};try{if(!navigator.canShare||!navigator.canShare(r))throw new Error("Can't share data.");await navigator.share(r)}catch(o){o.message!=="Share canceled"&&console.error(o.name,">",o.message)}};function Kr(e){const t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light",r=t==="dark"?"light":"dark",o=q("thememode").value;o==="auto"?(root.classList.add(r),root.classList.remove(t),q("thememode").value=r):o===r?(root.classList.add(t),root.classList.remove(r),q("thememode").value=t):!e&&o===t?(root.classList.remove(r),root.classList.remove(t),q("thememode").value="auto"):e&&o===t&&(root.classList.add(r),root.classList.remove(o),q("thememode").value=r)}function qr(e="auto",t=!1){q("thememode")||q("thememode",G(e)),e&&root.classList.add(e);const r={auto:"✻",dark:"☾",light:"✺"};return $`<div><a style="rotate:-90deg" :title="${()=>q("thememode").value}" @click="${()=>Kr(t)}">${()=>r[q("thememode").value]}</a></div>`}var Ae=/iPhone/i,lt=/iPod/i,st=/iPad/i,ct=/\biOS-universal(?:.+)Mac\b/i,Me=/\bAndroid(?:.+)Mobile\b/i,ut=/Android/i,ue=/(?:SD4930UR|\bSilk(?:.+)Mobile\b)/i,ye=/Silk/i,te=/Windows Phone/i,ft=/\bWindows(?:.+)ARM\b/i,dt=/BlackBerry/i,pt=/BB10/i,ht=/Opera Mini/i,vt=/\b(CriOS|Chrome)(?:.+)Mobile/i,gt=/Mobile(?:.+)Firefox\b/i,mt=function(e){return typeof e<"u"&&e.platform==="MacIntel"&&typeof e.maxTouchPoints=="number"&&e.maxTouchPoints>1&&typeof MSStream>"u"};function Jr(e){return function(t){return t.test(e)}}function Lt(e){var t={userAgent:"",platform:"",maxTouchPoints:0};!e&&typeof navigator<"u"?t={userAgent:navigator.userAgent,platform:navigator.platform,maxTouchPoints:navigator.maxTouchPoints||0}:typeof e=="string"?t.userAgent=e:e&&e.userAgent&&(t={userAgent:e.userAgent,platform:e.platform,maxTouchPoints:e.maxTouchPoints||0});var r=t.userAgent,o=r.split("[FBAN");typeof o[1]<"u"&&(r=o[0]),o=r.split("Twitter"),typeof o[1]<"u"&&(r=o[0]);var i=Jr(r),n={apple:{phone:i(Ae)&&!i(te),ipod:i(lt),tablet:!i(Ae)&&(i(st)||mt(t))&&!i(te),universal:i(ct),device:(i(Ae)||i(lt)||i(st)||i(ct)||mt(t))&&!i(te)},amazon:{phone:i(ue),tablet:!i(ue)&&i(ye),device:i(ue)||i(ye)},android:{phone:!i(te)&&i(ue)||!i(te)&&i(Me),tablet:!i(te)&&!i(ue)&&!i(Me)&&(i(ye)||i(ut)),device:!i(te)&&(i(ue)||i(ye)||i(Me)||i(ut))||i(/\bokhttp\b/i)},windows:{phone:i(te),tablet:i(ft),device:i(te)||i(ft)},other:{blackberry:i(dt),blackberry10:i(pt),opera:i(ht),firefox:i(gt),chrome:i(vt),device:i(dt)||i(pt)||i(ht)||i(gt)||i(vt)},any:!1,phone:!1,tablet:!1};return n.any=n.apple.device||n.android.device||n.windows.device||n.other.device,n.phone=n.apple.phone||n.android.phone||n.windows.phone,n.tablet=n.apple.tablet||n.android.tablet||n.windows.tablet,n}function Qr(e=null){if(Lt(window.navigator).apple.phone)return $`<div></div>`;async function r(){document.fullscreenElement?document.exitFullscreen&&await document.exitFullscreen():await document.documentElement.requestFullscreen()}function o(i){document.fullscreenElement?e&&e(!0):e&&e(!1)}return e&&document.addEventListener("fullscreenchange",o),$`<div><a @click="${r}">\u26F6</a></div>`}function ei(e){return new Worker("./assets/histogram_worker-ogrrdkqj.js",{name:e?.name})}function ti(e,t){let r;oe(()=>{s(),t&&t(d),r&&r(),r=Re({el:histo,onMove:({ev:u,x:l,y:f,el:p})=>{u.stopPropagation();const v=p.style.transform.match(/translate\((.*?)\)/)?.[1].split(",").map(x=>parseFloat(x))||[0,0],h=1;v[0]+=l/h,v[1]+=f/h,p.style.transform=`translate(${v[0]}px,${v[1]}px)`}})}),ce(()=>{c.terminate(),r()});let o,i,n,c,a=!1;async function s(){try{o=new OffscreenCanvas(10,10),o.width=350,i=o.getContext("2d",{colorSpace:e,willReadFrequently:!0}),n=document.getElementById("histogram").getContext("2d"),c=new ei,c.onmessage=async u=>{u.data.bitmap?(n.clearRect(0,0,n.canvas.width,n.canvas.height),n.drawImage(u.data.bitmap,0,0),a=!1):console.log(u.data)},c.onerror=u=>{throw console.error(`Worker error: ${u.message}`),u},c.postMessage({init:!0,width:n.canvas.width,height:n.canvas.height})}catch(u){console.error(u)}}async function d(){if(c&&!a){a=!0,o.height=o.width/(canvas.width/canvas.height),i.drawImage(canvas,0,0,canvas.width,canvas.height,0,0,o.width,o.height);const u=i?.getImageData(0,0,i.canvas.width,i.canvas.height).data;c.postMessage({pixels:u})}}return $`<div id="histo" style="position:absolute;left:10px;width:260px;height:100px;background-color:grey;padding:5px;cursor:pointer"><div style="position:absolute;color:grey;right:40px;font-size:80%">${e}</div><canvas id="histogram" width="256" height="150" style="width:100%;height:100%;background-color:#121212"></canvas></div>`}function ri(e){let t;return oe(async()=>{t=new maplibregl.Map({container:"map",style:"https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",center:e,zoom:9}),new maplibregl.Marker().setLngLat(e).addTo(t)}),ce(()=>{t?.remove()}),$`<style>#map{height:180px;width:180px;color:#000;border-radius:15px;margin:10px auto}</style><style>.maplibregl-ctrl-attrib{display:none}</style><div id="map"></div>`}function ii(e,t,r){const o=t.crop;t.trs;const i=G(!0);oe(()=>{E(o.currentcrop),crop.addEventListener("pointerdown",w)}),ce(()=>{crop.removeEventListener("pointerdown",w)});let n=!1,c,a,s,d,u,l,f;const p=50,v=100;function h(g){n=!1,crop.releasePointerCapture(g.pointerId),crop.removeEventListener("pointermove",_),crop.removeEventListener("pointerup",h),x(),o.currentcrop=f,r&&r(f)}function x(){f=croprect.getBoundingClientRect();const{offsetTop:g,offsetLeft:b,offsetHeight:B,offsetWidth:S}=croprect;f={...JSON.parse(JSON.stringify(f)),offsetTop:g,offsetLeft:b,offsetHeight:B,offsetWidth:S},f.offsetBottom=l.height-g-B,f.offsetRight=l.width-b-S}function w(g){n=!0,crop.setPointerCapture(g.pointerId),crop.addEventListener("pointermove",_),crop.addEventListener("pointerup",h),o.ar?(croprect.style.aspectRatio=o.ar,i.value=!1):(croprect.style.aspectRatio="",i.value=!0),c={x:g.x,y:g.y},l=crop.getBoundingClientRect(),x();const b=B=>B>=0&&B<=p;a=b(c.x-f.left+10),s=b(f.right-c.x+10),d=b(c.y-f.top+10),u=b(f.bottom-c.y+10),croprect.style.top=croprect.offsetTop+"px",croprect.style.bottom=l.height-croprect.offsetTop-croprect.offsetHeight+"px",croprect.style.left=croprect.offsetLeft+"px",croprect.style.right=l.width-croprect.offsetLeft-croprect.offsetWidth+"px"}function _(g){if(n){let y=function(T,R,P){return Math.max(T,Math.min(R,P))},b=g.x-c.x,B=g.y-c.y,S=croprect.style.aspectRatio;const C=S.split("/")[0]/S.split("/")[1];d&&(S?(s||a)&&(croprect.style.top="auto",croprect.style.bottom=l.height-croprect.offsetTop-croprect.offsetHeight+"px"):croprect.style.top=y(0,f.offsetTop+B,f.offsetTop+f.offsetHeight-v)+"px"),u&&(S?(s||a)&&(croprect.style.top=croprect.offsetTop+"px",croprect.style.bottom="auto"):croprect.style.bottom=y(0,f.offsetBottom-B,f.offsetBottom+f.offsetHeight-v)+"px"),a&&(S?d?croprect.style.left=y(Math.max(0,l.width-f.offsetRight-(f.offsetTop+f.offsetHeight)*C),f.offsetLeft+b,f.offsetLeft+f.offsetWidth-v)+"px":croprect.style.left=y(Math.max(0,l.width-f.offsetRight-(l.height-f.offsetTop)*C),f.offsetLeft+b,f.offsetLeft+f.offsetWidth-v)+"px":croprect.style.left=y(0,f.offsetLeft+b,f.offsetLeft+f.offsetWidth-v)+"px"),s&&(S?d?croprect.style.right=y(Math.max(0,l.width-f.offsetLeft-(f.offsetTop+f.offsetHeight)*C),f.offsetRight-b,f.offsetRight+f.offsetWidth-v)+"px":croprect.style.right=y(Math.max(0,l.width-f.offsetLeft-(l.height-f.offsetTop)*C),f.offsetRight-b,f.offsetRight+f.offsetWidth-v)+"px":croprect.style.right=y(0,f.offsetRight-b,f.offsetRight+f.offsetWidth-v)+"px"),!d&&!u&&!a&&!s&&(croprect.style.top=y(0,f.offsetTop+B,l.height-f.offsetHeight)+"px",croprect.style.bottom=y(0,f.offsetBottom-B,l.height-f.offsetHeight)+"px",croprect.style.left=y(0,f.offsetLeft+b,l.width-f.offsetWidth)+"px",croprect.style.right=y(0,f.offsetRight-b,l.width-f.offsetWidth)+"px")}}function E(g){const b=document.getElementById("crop");if(b.style.width=Math.round(e.offsetWidth)+"px",b.style.height=Math.round(e.offsetHeight)+"px",o.ar?croprect.style.aspectRatio=o.ar:croprect.style.aspectRatio="",!g)croprect.style.inset="0",o.currentcrop=0;else{const B=g;croprect.style.inset=`${B.offsetTop}px ${B.offsetRight}px ${B.offsetBottom}px ${B.offsetLeft}px`}r&&r(g||0)}let m=0;function M(g){if(g.preventDefault(),m&&Date.now()-m<200)return E();m=Date.now()}return $`
      <div id="crop" @dblclick="${()=>E()}" @click="${M}" style="width:${e?.offsetWidth}px;height:${e?.offsetHeight}px">
       <div id="croprect" style="inset:0;">
          <div class="cropcorner" id="top_left" ></div>
          <div class="cropcorner" id="top_right" ></div>
          <div class="cropcorner" id="bottom_left" ></div>
          <div class="cropcorner" id="bottom_right" ></div>
          ${()=>i.value&&$`
            <div class="cropcorner" id="left" ></div>
            <div class="cropcorner" id="right" ></div>
            <div class="cropcorner" id="top" ></div>
            <div class="cropcorner" id="bottom" ></div>
          `}
        </div>
      </div>
  `}function oi(e,t,r,o,i){oe(()=>{n(o),splitview_container.addEventListener("pointerdown",s)}),ce(()=>{splitview_container.removeEventListener("pointerdown",s)});function n(l){l||(o=.5),splitview.src=e.src,splitview.width=e.width,splitview.height=e.height,splitview_container.style.width=t,splitview_container.style.height=r,splitview_container.style.aspectRatio="auto "+e.width+"/"+e.height,splitview.style.clipPath=`inset(0px ${(1-o)*100}% 0px 0px)`,splitview_bar.style.left=`calc(${o*100}% - 5px)`}let c=!1,a;function s(l){c=!0,splitview_container.setPointerCapture(l.pointerId),splitview_container.addEventListener("pointermove",u),splitview_container.addEventListener("pointerup",d),a=l.clientX}function d(l){c=!1,splitview_container.releasePointerCapture(l.pointerId),splitview_container.removeEventListener("pointermove",u),splitview_container.removeEventListener("pointerup",d),i&&i(o)}function u(l){if(c){l.preventDefault(),l.stopPropagation();const f=1/splitview_container.clientWidth,p=zoomable.style.transform.match(/scale\((.*?)\)/)?.[1].split(",").map(v=>parseFloat(v))[0]||1;o+=(l.clientX-a)*f/p,a=l.clientX,o=Math.max(.1,Math.min(.9,o)),splitview.style.clipPath=`inset(0px ${(1-o)*100}% 0px 0px)`,splitview_bar.style.left=`calc(${o*100}% - 5px)`}}return $`<div id="splitview_container"><img id="splitview"><div id="splitview_bar"></div></div>`}function Ie(e,t,r,o){async function i(){try{const s=await Rt(t);if(!s)return;r(s)}catch(s){console.error(s)}}function n(s){s.preventDefault();const d=s.target;d.style.borderColor="";let u;if(s.dataTransfer.items){const l=s.dataTransfer.items[0];if(!l.type.match("^"+t.split(",").map(f=>"^"+f).join("|")))return se("unknown format");u=l.getAsFile()}else u=s.dataTransfer.files[0];r(u)}function c(s){s.preventDefault();const d=s.target;d.style.borderColor||(d.style.borderColor="darkorange")}function a(s){s.preventDefault();const d=s.target;d.style.borderColor&&(d.style.borderColor="")}return $`<button id="clickdrop_btn" @click="${i}" @drop="${n}" @dragover="${c}" @dragleave="${a}" style="${o||""}">${e}</button>`}async function ni(e){return e.split(",")[0].match(/:(.*?);/)[1],fetch(e).then(function(r){return r.arrayBuffer()})}async function ai(e,t,r,o){const i=e.value,n=i.file.name,c=G(n.split(".")[0]),a=G("jpeg"),s=G("0.9");function d(l){a.value=l.target.value}if(await Ct(()=>$`<div style="margin:10px 0"><div style="height:38px">${o?"Save ":"Download "}image</div><div style="display:flex;flex-direction:column;font-size:14px"><div><input style="width:225px;font-size:14px" type="text" :value="${()=>c.value}" @change="${(l=>c.value=l.target.value)}" disabled="${!!o}"> <select style="width:60px;height:29px;font-size:14px" @change="${d}"><option value="jpeg" selected="selected">jpeg</option><option value="png">png</option></select></div><div style="height:60px;display:flex;justify-content:space-between;align-items:center">${()=>a.value==="jpeg"&&$`<div style="display:flex;align-items:center"><label style="color:gray;margin-right:10px">Quality</label> <input type="range" min="0.1" max="1.0" step="0.1" :value="${()=>s.value}" @input="${l=>s.value=l.target.value}"> <span style="width:30px;text-align:right">${()=>s.value.padEnd(3,".0")}</span></div>`}</div></div></div>`)){const l=t.extract();let p=r.captureImage("image/"+a.value,a.value==="jpeg"&&parseFloat(s.value)).src;const v=await ni(p),h=Bt(v);l&&(h.replace(l),i?.tiff?.Orientation&&h.patch({area:"tiff",field:"Orientation",value:1})),c.value+="."+a._value,o?o(n,new Blob([h.image()]),a._value):Lt(window.navigator).any?Zr(c.value,new Blob([h.image()])):h.download(c.value)}}const li=`<svg style="width:60%;" viewBox="0 0 256 256"  xmlns="http://www.w3.org/2000/svg">
<rect x="54.8183" y="90.0903" width="120.743" height="120.743" rx="14.2449"  stroke-width="17.6366" fill="transparent"/>
<path d="M221.004 115.176L221.004 89.1424C221.004 63.8095 200.046 43.2732 174.193 43.2732L149.101 43.2732" stroke-width="17.6366" stroke-linecap="round" fill="transparent"/>
<path d="M131.428 47.5313C128.678 45.3586 128.678 41.1878 131.428 39.0151L155.912 19.671C159.471 16.8597 164.703 19.3941 164.703 23.929L164.703 62.6174C164.703 67.1523 159.471 69.6868 155.912 66.8755L131.428 47.5313Z" />
</svg>`,xt=`<svg style="width:60%;" viewBox="0 0 256 256"  xmlns="http://www.w3.org/2000/svg">
<path d="M40.2407 220.5L102.5 112.324L102.5 220.5H40.2407Z"  stroke-width="13" stroke-linejoin="round" fill="transparent"/>
<path d="M211.759 220.5L149.5 112.324L149.5 220.5H211.759Z"  stroke-width="13" stroke-linejoin="round" fill="transparent"/>
<line x1="78" y1="59.5" x2="174" y2="59.5"  stroke-width="13"/>
<path d="M45.3896 63.5218C42.6395 61.3491 42.6395 57.1783 45.3896 55.0056L69.8741 35.6614C73.4324 32.8501 78.6648 35.3846 78.6648 39.9195L78.6648 78.6079C78.6648 83.1428 73.4324 85.6773 69.8741 82.8659L45.3896 63.5218Z" />
<path d="M207.163 55.0056C209.913 57.1783 209.913 61.349 207.163 63.5217L182.679 82.8659C179.12 85.6772 173.888 83.1428 173.888 78.6078L173.888 39.9195C173.888 35.3846 179.12 32.8501 182.679 35.6614L207.163 55.0056Z" />
</svg>`,si='<svg style="width:50%;" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><g stroke-width="0"></g><g  stroke-linecap="round" stroke-linejoin="round"></g><g ><path d="M 5.4648 42.5781 C 7.5272 42.5781 9.3085 41.3594 10.1757 39.6016 L 45.4724 49.9609 C 46.0820 52.2109 48.1211 53.875 50.5585 53.875 C 53.4179 53.875 55.7852 51.5313 55.7852 48.6484 C 55.7852 46.4687 54.4489 44.5937 52.5505 43.7969 L 51.5665 20.2422 C 53.5820 19.5156 55.0350 17.5703 55.0350 15.2969 C 55.0350 12.4140 52.6681 10.0703 49.8083 10.0703 C 47.9099 10.0703 46.2227 11.1016 45.3083 12.625 L 25.7851 7.2578 C 25.7851 4.4922 23.4179 2.1250 20.5585 2.1250 C 17.6757 2.1250 15.3085 4.4922 15.3085 7.3750 C 15.3085 8.9219 15.9882 10.3281 17.0897 11.2891 L 6.2148 32.1484 C 5.9804 32.1016 5.7226 32.1016 5.4648 32.1016 C 2.5819 32.1016 .2148 34.4453 .2148 37.3281 C .2148 40.2109 2.5819 42.5781 5.4648 42.5781 Z M 20.5585 12.625 C 22.2694 12.625 23.8163 11.7578 24.7772 10.4453 L 44.5820 15.9062 C 44.8398 17.9922 46.3163 19.7266 48.2852 20.3125 L 49.1056 43.5859 C 47.5585 44.0547 46.2928 45.2031 45.6836 46.6797 L 10.5976 36.3672 C 10.4101 35.3828 9.9413 34.4687 9.2851 33.7656 L 20.1601 12.6016 C 20.2772 12.6016 20.4179 12.625 20.5585 12.625 Z"></path></g></svg>';function It(e,t,r,o){let n=t.slice(0);const{top:c,left:a}=e.getBoundingClientRect();let s=e.offsetWidth,d=e.offsetHeight,u,l=!1,f;oe(()=>{mousecontainer.addEventListener("pointerdown",x),u=mousecanvas.getContext("2d"),_()}),ce(()=>{mousecontainer.removeEventListener("pointerdown",x)});function p(m,M,g){return Math.max(m,Math.min(g,M))}function v(m){var M=p(0,m.offsetX/s,1),g=p(0,m.offsetY/d,1);n[f]=[M,g]}function h(m){l=!1,f=void 0,mousecontainer.releasePointerCapture(m.pointerId),mousecontainer.removeEventListener("pointermove",w),mousecontainer.removeEventListener("pointerup",h)}function x(m){l=!0;const M=document.elementFromPoint(m.x,m.y);M.id.startsWith("mouse")&&(f=parseInt(M.id.replace("mouse",""))),mousecontainer.setPointerCapture(m.pointerId),mousecontainer.addEventListener("pointermove",w),mousecontainer.addEventListener("pointerup",h);const{left:g,top:b}=M.getBoundingClientRect();v(m)}function w(m){l&&f!==void 0&&(v(m),me("mouse",()=>_(),20))}function _(){document.getElementById("mouse0")&&(n.forEach((m,M)=>{const g=document.getElementById("mouse"+M),b=m[0]*s-g.offsetWidth/2+"px",B=m[1]*d-g.offsetHeight/2+"px";g.style.left!==b&&(g.style.left=b),g.style.top!==B&&(g.style.top=B)}),r&&r(n,u))}function E(){o?n=o(n):n=t.slice(0),_()}return $`
      <style>
        #mousecontainer{position: fixed;top:${c}px;left:${a}px;width:${s}px;height:${d}px;}
        #mousecanvas{overflow:hidden;border:0px solid white;}
        .point{position:absolute;width: ${45}px;height: ${45}px;background-color:white; border-radius: 50%;cursor:pointer;border: 15px solid transparent;background-clip: padding-box;box-sizing: border-box;}
      </style>
      <div id="mousecontainer" @dblclick="${E}">
        <canvas id="mousecanvas" width="${s}" height="${d}"></canvas>
        ${n?.map((m,M)=>$`
            <div id="mouse${M}" style="left:${m[0]*s-45/2}px;top:${m[1]*d-45/2}px;" class="point" ></div>
          `)}
      </div>
  `}function ci(e,t,r){let o=[[.25,.25],[.75,.25],[.75,.75],[.25,.75]],i=t?.after||t?.before||o,n=0;t?.before&&(n=1);let c=!0;function a(d,u){u.clearRect(0,0,mousecanvas.width,mousecanvas.height),u.lineWidth=3,u.strokeStyle="red",u.beginPath();for(var l=0;l<4;l++){const f=d[l][0]*mousecanvas.width,p=d[l][1]*mousecanvas.height;u.lineTo(f,p)}u.closePath(),u.stroke(),c?c=!1:t.modified||(t.modified=!0),n?(t.after=d,r&&r()):t.before=d}function s(d){return t.modified=!1,o}return $`<style>#mousecanvas{border:1px solid #fff;background-image:repeating-linear-gradient(#ccc 0 1px,transparent 1px 100%),repeating-linear-gradient(90deg,#ccc 0 1px,transparent 1px 100%);background-size:9.99% 9.99%}</style>${It(e,i,a,s)}`}function ne(e,t,r,o,i,n,c){function a(){o[e]?.$skip||n&&n(e)}function s(d){d.preventDefault(),d.stopPropagation();const u=document.getElementById("btn_skip_"+e),l=document.getElementById(e),f=document.getElementById(e+"_content");o[e].$skip?(o[e].$skip=!1,u?.removeAttribute("disabled"),l?.removeAttribute("skipped"),f?.classList.remove("skip"),l.style.opacity="",i(!0)):(o[e].$skip=!0,u?.setAttribute("disabled",!0),l?.setAttribute("skipped",!0),f?.classList.add("skip"),i(!1))}return $`<div class="section" id="${e}" :style="${()=>r.value===e&&`height:${t}px;`}" :selected="${()=>r.value===e}" @click="${d=>{d.stopPropagation(),r.value=e}}"><div class="section_header">${!!i&&$`<a id="btn_skip_${e}" class="section_skip" @click="${s}" title="toggle">\u2609</a>`} <b class="section_label">${e}</b> ${!!n&&$`<a id="btn_reset_${e}" class="reset_btn" @click="${a}" disabled="disabled" title="reset">\u00D8</a>`}</div>${()=>r.value===e&&$`<div id="${e}_content" class="section_content ${o[e]?.$skip?"skip":""}" @click="${d=>d.stopPropagation()}"><div class="section_scroll"><hr><button class="close_btn" @click="${()=>r.value=""}">X</button> ${c}</div></div>`}</div>`}function ui(e,t,r,o,i){let n,c;G(()=>{e.value==="composition"?(n=o(),n.resetCrop(),p[1]=n.gl.canvas.width/n.gl.canvas.height,p[2]=1/p[1],h(),r(),c=e.value):c==="composition"&&(g(),c=void 0,a())},{effect:!0});async function a(){const P=t;if(!croprect)return;crop.style.display="";const A=canvas.width/crop.offsetWidth;P.crop.glcrop={left:Math.round(croprect.offsetLeft*A),top:Math.round(croprect.offsetTop*A),width:Math.round(croprect.offsetWidth*A),height:Math.round(croprect.offsetHeight*A)},r(),i()}function s(){if(!document.getElementById("croprect"))return;Object.keys(t.crop).forEach(U=>{t.crop[U]=0}),v(0),h(),Object.keys(t.trs).forEach(U=>{t.trs[U]=0,_("trs_"+U)}),Object.keys(t.perspective2).forEach(U=>{t.perspective2[U]=0});const A=document.getElementById("fliph"),L=document.getElementById("flipv");A.removeAttribute("selected"),L.removeAttribute("selected"),g(),d(),y(),l(),r()}function d(P){const A=document.getElementById("crop"),L=document.getElementById("croprect");A.style.width=Math.round(canvas.getBoundingClientRect().width)+"px",A.style.height=Math.round(canvas.getBoundingClientRect().height)+"px",t.crop.ar&&(L.style.aspectRatio=t.crop.ar),L.style.inset="0",t.crop.currentcrop=0}function u(P){P==="v"?(t.trs.flipv=!t.trs.flipv,t.trs.flipv?flipv.setAttribute("selected",!0):flipv.removeAttribute("selected")):(t.trs.fliph=!t.trs.fliph,t.trs.fliph?fliph.setAttribute("selected",!0):fliph.removeAttribute("selected")),l(),r()}function l(){Object.values(t.trs).reduce((A,L)=>A+=L,0)===0&&Object.values(t.crop).reduce((A,L)=>A+=L,0)===0&&t.perspective2.modified==0&&t.resizer.width===0?btn_reset_composition.setAttribute("disabled",!0):btn_reset_composition.removeAttribute("disabled")}const f=["free","pic","1:pic","1:1","4:3","16:9","3:4","9:16"];let p=[0,0,0,1,4/3,16/9,3/4,9/16];function v(P){g(),t.crop.arindex=P,t.crop.ar=p[P],croprect&&(croprect.style.aspectRatio=p[P]);const A=document.getElementById("aspects");A&&(A.querySelector("[selected]")?.removeAttribute("selected"),A.querySelector("#ar_"+P)?.setAttribute("selected",!0)),l()}function h(){const{width:P,height:A}=n;t.crop.canvas_angle%180?(n.gl.canvas.width=A,n.gl.canvas.height=P):(n.gl.canvas.width=P,n.gl.canvas.height=A),n.setupFiltersTextures(),i()}function x(P){t.crop.canvas_angle=(t.crop.canvas_angle+P)%360,h(),crop.style.width=Math.round(canvas.getBoundingClientRect().width)+"px",crop.style.height=Math.round(canvas.getBoundingClientRect().height)+"px",croprect.style.inset="0",g(),l(),r()}function w(P){const A=P.target.value,L=this.id.split("_");if(t[L[0]][L[1]]=parseFloat(A),L.length===3?this.nextElementSibling.value=A:this.previousElementSibling.value=A,L[1]==="angle"){const U=parseFloat(Math.abs(A))*Math.PI/180,J=canvas.width*Math.cos(U)+canvas.height*Math.sin(U),k=canvas.width*Math.sin(U)+canvas.height*Math.cos(U),I=Math.max(J/canvas.width-1,k/canvas.height-1);t.trs.scale=I,l()}r()}function _(P){const A=document.getElementById(P);if(!A)return;const L=P.split("_");A.value=t[L[0]][L[1]],A.previousElementSibling.value=A.value}function E(){if(!this)return;const P=this.id.split("_");t[P[0]][P[1]]=0,_(this.id),P[1]==="angle"&&(t.trs.scale=0),l(),r()}let m=G(!1);async function M(){m.value=t.perspective2,crop.style.display="none"}function g(){const P=document.getElementById("crop");P&&(P.style.display=""),m.value=!1}function b(){m.value?g():M()}function B(){t.perspective2.before&&(t.perspective2.after=0,m.value=!1,m.value=t.perspective2)}const S=G(100);function C(P,A){resize_width.value=t.resizer.width=P,resize_height.value=t.resizer.height=A,n.resize(P,A),S.value=Math.round(P/n.img.width*1e3)/10,h(),d(),l(),r()}function y(){n.resetResize(),t.resizer.width=0,t.resizer.height=0,resize_width.value=n.width,resize_height.value=n.height,S.value=100}function T(){const P=p[1],A=Math.max(100,this.value),L=Math.floor(A/P);C(A,L)}function R(){const P=p[1],A=Math.max(100,this.value),L=Math.floor(A*P);C(L,A)}return $`${ne("composition",235,e,t,null,s,()=>$`<style>.crop_btn{width:38px;color:#fff;padding:0;margin:2px;border-radius:50%;fill:white;stroke:white;font-size:12px}.close_btn{display:none!important}</style><button class="done_btn" @click="${()=>e.value=""}">done</button><div style="display:flex;justify-content:flex-end;color:grey;margin-right:3px"><div style="flex:1;align-content:center;text-align:left"><span>rotation </span><input id="trs_angle_" style="width:75px" type="number" class="rangenumb" step="0.25" min="-45" max="45" value="${t.trs.angle}" @input="${w}"> <input id="trs_angle" type="range" value="${t.trs.angle}" min="-45" max="45" step="0.25" @input="${w}" @dblclick="${E}"></div><button id="fliph" class="crop_btn" title="flip x" selected="${!!t.trs.fliph}" @click="${()=>u("h")}">${xt}</button> <button id="flipv" class="crop_btn" title="flip y" selected="${!!t.trs.flipv}" @click="${()=>u("v")}" style="rotate:270deg">${xt}</button> <button class="crop_btn" title="rotate left" @click="${()=>x(-90)}">${li}</button> <button class="crop_btn" title="perspective" :selected="${()=>!!m.value}" @click="${b}">${si}</button></div>${()=>m.value&&$`<hr>${()=>!m.value.before&&$`<div style="text-align:center;color:#e9967a">position corners AND <button @click="${B}">lock rect</button></div>`} ${()=>!!m.value.before&&$`<div style="text-align:center;color:#e9967a">drag corners</div>`} ${ci(canvas,m.value,()=>{l(),r()})}`}<hr><div style="text-align:left;color:gray">crop ratio</div><div style="text-align:left" id="aspects">${f.map((P,A)=>$`<button id="ar_${A}" @click="${()=>v(A)}" class="crop_btn" selected="${A===t.crop.arindex}" @dblclick="${d}">${P}</button>`)}</div><hr><div style="text-align:left;color:gray">image size</div><div style="display:flex;justify-content:space-around;align-items:center"><div style="width:100px;text-align:left;color:gray">(${()=>S.value+"%"})</div><input id="resize_width" type="number" value="${canvas.width}" style="text-align:center;width:90px" @change="${T}"> x <input id="resize_height" type="number" value="${canvas.height}" style="text-align:center;width:90px" @change="${R}"></div>`)}`}function fi(e,t,r){const o={lights:190,colors:150,effects:105};G(()=>{e.value===null&&["lights","colors","effects"].forEach(f=>a(f))},{effect:!0});function i(f){return Object.values(t[f]).reduce((p,v)=>p+=v,0)===0}function n(f){for(const p of Object.keys(t[f]))t[f][p]=0,u(f+"_"+p)}function c(f){n(f),r(),a(f)}function a(f){const p=document.getElementById("btn_reset_"+f);p&&(i(f)?p.setAttribute("disabled",!0):p.removeAttribute("disabled"))}function s(f){me("param",()=>d.call(this,f),30)}function d(f){const p=f.target.value,v=this.id.split("_");t[v[0]][v[1]]=parseFloat(p),u(this.id),r(),a(v[0])}function u(f){const p=document.getElementById(f);if(!p)return;const v=f.split("_");p.value=t[v[0]][v[1]],v.length===3?p.previousElementSibling.value=p.value:p.nextElementSibling.value=p.value}function l(){if(!this)return;const f=this.id.split("_");t[f[0]][f[1]]=0,u(this.id),r(),a(f[0])}return $`${["lights","colors","effects"].map(f=>$`${ne(f,o[f],e,t,r,c,()=>$`${Object.keys(t[f]).filter(p=>!p.startsWith("$")).map(p=>$`/* RANGE INPUTS */<div style="display:flex;justify-content:space-around;align-items:center"><div class="rangelabel">${p}</div><input id="${f+"_"+p}" type="range" style="width:130px" value="${t[f][p]}" min="-1" max="1" step="0.01" @input="${s}" @dblclick="${l}"> <input id="${f+"_"+p+"_"}" type="number" class="rangenumb" value="${t[f][p]}" min="-1" max="1" step="0.01" @input="${s}"></div>`)}`)}`)}`}function di(e,t){const i=G(e?.numpoints||5);let n=e?.space||0,c=e?.curvepoints||new Array(4).fill(null),a=new Array(4);c.forEach((g,b)=>{g?a[b]=!0:a[b]=null});function s(g){c[g]=[];for(let b=0;b<i._value;b++){const B=b/(i._value-1);c[g].push([B,B])}a[g]=null}function d(){s(n),M()}c[n]?.length||s(n);let u,l,f;oe(()=>{curvecontainer.addEventListener("pointerdown",w),u=curvescanvas.offsetWidth,l=curvescanvas.offsetHeight,f=curvescanvas.getContext("2d"),p("space"+n),e.resetFn=()=>{e.space=0,e.curvepoints=null,n=0,c=new Array(4).fill(null),p("space"+n)}}),ce(()=>{curvecontainer.removeEventListener("pointerdown",w)});function p(g){g=typeof g=="string"?g:this?.id;const b=document.getElementById(g);b&&(cccolors.getElementsByClassName("selected")[0]?.classList.remove("selected"),b.classList.add("selected"),n=parseInt(g.replace("space","")),e.space=n,c[n]||s(n),M())}let v=!1,h;function x(g){v=!1,curvecontainer.releasePointerCapture(g.pointerId),curvecontainer.removeEventListener("pointermove",m),curvecontainer.removeEventListener("pointerup",x),h=void 0}function w(g){v=!0,curvecontainer.setPointerCapture(g.pointerId),curvecontainer.addEventListener("pointermove",m),curvecontainer.addEventListener("pointerup",x),u=curvescanvas.offsetWidth,l=curvescanvas.offsetHeight;const b=document.elementFromPoint(g.x,g.y);b.id.startsWith("pt")&&(h=parseInt(b.id.replace("pt",""))),a[n]=!0,E(g)}function _(g,b,B){return Math.max(g,Math.min(B,b))}function E(g){const b=h?c[n][h-1][0]+.1:0,B=h<i._value-1?c[n][h+1][0]-.1:1;var S=_(b,g.offsetX/u,B),C=_(0,1-g.offsetY/l,1);c[n][h]=[S,C]}function m(g){v&&h!==void 0&&(E(g),me("curve",()=>M(),20))}function M(){if(!c?.[n])return;c[n].forEach((y,T)=>{const R=document.getElementById("pt"+T);R.style.left=y[0]*u-45/2+"px",R.style.bottom=y[1]*l-45/2+"px"});const g=c[n].map(y=>y[0]),b=c[n].map(y=>y[1]),B=new Ne(c[n]);let S;f.clearRect(0,0,256,256),f.lineWidth=4,f.strokeStyle="#4B4947",f.beginPath();for(var C=0;C<256;C++)C<g[0]*256?S=b[0]:C>g[g.length-1]*256?S=b[b.length-1]:S=_(0,B.at(C/255),1),f.lineTo(C,(1-S)*256);f.stroke(),f.fillStyle="white",t&&t(c,a)}return $`
      <style>
        #curvecontainer{position: relative;width:200px;height: 120px;margin:auto;background-image: radial-gradient(#5b5b5b 1px, transparent 0);background-size: 10% 10%;border-radius: 10px;border: 1px solid #5b5b5b;}
        #curvescanvas{width:inherit;height: inherit;overflow:hidden;border:0px solid white;}
        .point{position:absolute;background-color: white; width: ${45}px;height: ${45}px; border-radius: 50%;cursor:pointer;border: 17px solid transparent;background-clip: padding-box;box-sizing: border-box;}
      </style>
      <div id="cccolors" style="display:flex;flex-direction:row; max-width:275px;">
        <div style="width:60px;">
          <button id="space0" @click="${p}" class="clrspace selected" style="border-color:white;" title="all colors"></button>
          <button id="space1" @click="${p}" class="clrspace" style="border-color:#c13119;" title="red"></button>
          <button id="space2" @click="${p}" class="clrspace" style="border-color:#0c9427;" title="green"></button>
          <button id="space3" @click="${p}" class="clrspace" style="border-color:#1e73be;" title="blue"></button>
        </div>
        <div id="curvecontainer" @dblclick="${d}">
          <canvas id="curvescanvas" width=${256} height=${256}></canvas>
          ${()=>i.value&&c[n]?.map((g,b)=>$`
              <div id="pt${b}" class="point"></div>
            `)}
        </div>
      </div>
  `}function pi(e,t,r){let o=t.curve,i={space:0,numpoints:5,curvepoints:t.curve?.curvepoints||null,modifiedflag:null,resetFn:null};G(()=>{e.value===null&&t.curve?.curvepoints&&(o=t.curve,n(o.curvepoints,[!0,!0,!0,!0]))},{effect:!0});function n(s,d){i.curvepoints=d.map((u,l)=>u&&s[l]),i.curvepoints.reduce((u,l)=>u+=l,0)===0?o.curvepoints=0:o.curvepoints=i.curvepoints,a(),r()}function c(){i.resetFn&&i.resetFn()}function a(){document.getElementById("btn_reset_curve")&&(i?.curvepoints?.reduce((d,u)=>d+=u,0)===0?btn_reset_curve?.setAttribute("disabled",!0):btn_reset_curve?.removeAttribute("disabled"))}return $`${ne("curve",190,e,t,r,c,()=>$`<div class="cc_container">${()=>di(i,n)}</div>`)}`}const hi=(function(){const t=typeof document<"u"&&document.createElement("link").relList;return t&&t.supports&&t.supports("modulepreload")?"modulepreload":"preload"})(),vi=function(e){return"/"+e},bt={},Z=function(t,r,o){let i=Promise.resolve();if(r&&r.length>0){let c=function(d){return Promise.all(d.map(u=>Promise.resolve(u).then(l=>({status:"fulfilled",value:l}),l=>({status:"rejected",reason:l}))))};document.getElementsByTagName("link");const a=document.querySelector("meta[property=csp-nonce]"),s=a?.nonce||a?.getAttribute("nonce");i=c(r.map(d=>{if(d=vi(d),d in bt)return;bt[d]=!0;const u=d.endsWith(".css"),l=u?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${d}"]${l}`))return;const f=document.createElement("link");if(f.rel=u?"stylesheet":hi,u||(f.as="script"),f.crossOrigin="",f.href=d,s&&f.setAttribute("nonce",s),document.head.appendChild(f),u)return new Promise((p,v)=>{f.addEventListener("load",p),f.addEventListener("error",()=>v(new Error(`Unable to preload CSS for ${d}`)))})}))}function n(c){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=c,window.dispatchEvent(a),!a.defaultPrevented)throw c}return i.then(c=>{for(const a of c||[])a.status==="rejected"&&n(a.reason);return t().catch(n)})},gi='<svg xml:space="preserve" viewBox="0 0 100 100" y="0" x="0" xmlns="http://www.w3.org/2000/svg" id="圖層_1" version="1.1" style="margin: initial; display: block; shape-rendering: auto; background: transparent;" preserveAspectRatio="xMidYMid"><g class="ldl-scale" style="transform-origin: 50% 50%; transform: rotate(0deg) scale(0.8, 0.8);"><g class="ldl-ani" style="transform-box: view-box; opacity: 1; transform-origin: 50px 50px; transform: matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1); animation: 1s linear 0s infinite normal forwards running animate;"><g class="ldl-layer"><g class="ldl-ani" style="transform-box: view-box;"><path fill="inherit" d="M89.982 48.757h-.002a40.04 40.04 0 0 0-2.246-12.003l-.125-.332a40.721 40.721 0 0 0-.574-1.517l-.334-.774a33.907 33.907 0 0 0-.487-1.112l-.078-.168c-.166-.355-.344-.705-.531-1.075l-.187-.367c-.13-.249-.266-.495-.404-.744l-1.44-2.406a38.537 38.537 0 0 0-.666-1.001l-1.74-2.292L59.423 62.63h28.506l.406-1.328c.048-.151.095-.303.137-.451a40.634 40.634 0 0 0 .717-2.97 36.2 36.2 0 0 0 .187-.96c.112-.631.202-1.266.284-1.905l.042-.314c.029-.208.057-.415.077-.619.107-1.026.174-1.96.201-2.843l.02-1.137-.018-1.346z"  ></path></g></g><g class="ldl-layer"><g class="ldl-ani" style="transform-box: view-box;"><path fill="inherit" d="M58.024 89.163l1.838-.429c.358-.091.714-.187 1.073-.288.58-.165 1.156-.346 1.728-.536l.178-.059c.285-.094.569-.189.847-.29.607-.22 1.204-.463 1.797-.711l.27-.11c.199-.081.398-.161.598-.251a41.757 41.757 0 0 0 2.686-1.315l.21-.115c.214-.116.404-.225.584-.331l1.229-.729a40.14 40.14 0 0 0 4.94-3.618 40.837 40.837 0 0 0 2.129-1.971l.121-.113a40.584 40.584 0 0 0 4.588-5.474l.121-.175c.208-.303.411-.61.688-1.037l2.006-3.501c.161-.315.324-.641.412-.844l1.029-2.795H43.77l14.254 24.692z"  ></path></g></g><g class="ldl-layer"><g class="ldl-ani" style="transform-box: view-box;"><path fill="inherit" d="M20.094 76.527l.955 1.023c.106.115.21.229.318.341a41.011 41.011 0 0 0 2.12 2.022l.196.174c.208.186.418.37.631.549.49.412.995.806 1.503 1.192l.244.19c.169.131.337.263.51.388A40.702 40.702 0 0 0 28.934 84l1.219.724c.187.11.376.219.584.334l.337.178c.759.407 1.536.776 2.445 1.194.106.054.213.107.311.149a39.841 39.841 0 0 0 8.692 2.698l.157.032c.622.115 1.244.217 1.859.303l.564.066c.501.063 1.002.125 1.499.168l.183.017c.391.03.78.054 1.269.08l.359.017c.272.011.542.018.91.024l.697.009.854-.014c.246-.005.495-.011.736-.021l.432-.02c.391-.021.78-.045 1.321-.088l2.649-.483L34.347 51.84 20.094 76.527zm26.815 11.795v.002-.002z"  ></path></g></g><g class="ldl-layer"><g class="ldl-ani" style="transform-box: view-box;"><path fill="inherit" d="M79.906 23.463l-.961-1.029a13.335 13.335 0 0 0-.326-.349 39.14 39.14 0 0 0-2.12-2.021l-.116-.103c-.228-.202-.454-.404-.685-.598a38.415 38.415 0 0 0-1.539-1.219l-.234-.183c-.16-.125-.32-.249-.489-.373a40.813 40.813 0 0 0-2.371-1.601l-2.148-1.239a40.129 40.129 0 0 0-11.527-4.055 39.84 39.84 0 0 0-3.868-.537 1.465 1.465 0 0 0-.22-.023l-2.452-.123-.05 1.115-.127-1.118-1.544.003c-.246.005-.494.011-.75.021l-.424.021a37.51 37.51 0 0 0-1.174.077l-2.908.296 21.78 37.725 14.253-24.687z"  ></path></g></g><g class="ldl-layer"><g class="ldl-ani" style="transform-box: view-box;"><path fill="inherit" d="M41.974 10.828l-1.372.32c-.157.035-.314.069-.468.109a41.654 41.654 0 0 0-2.807.826l-.161.054a42.89 42.89 0 0 0-.85.291c-.613.222-1.221.468-1.819.718l-.263.107c-.195.08-.389.158-.581.244-.936.417-1.776.827-2.576 1.254l-2.137 1.235c-3.491 2.154-6.615 4.828-9.369 8.043-.285.334-.561.667-.844 1.022l-.214.276a36.63 36.63 0 0 0-.7.918l-.308.427c-.198.278-.386.54-.605.866l-1.832 2.984-.127.228c-.103.184-.204.37-.312.575l-.254.489c-.172.341-.343.682-.507 1.026l-1.207 2.676H56.23L41.974 10.828z"  ></path></g></g><g class="ldl-layer"><g class="ldl-ani" style="transform-box: view-box;"><path fill="inherit" d="M12.071 37.361l-.404 1.322c-.048.155-.097.309-.139.457a39.505 39.505 0 0 0-.691 2.848l-.038.18c-.062.302-.124.604-.175.903a40.32 40.32 0 0 0-.284 1.906l-.042.309c-.029.208-.057.417-.077.62a38.802 38.802 0 0 0-.201 2.854l-.014.376c-.006.234-.006.441-.006.649l.02 1.444c.13 4.087.884 8.123 2.247 12.01l.137.37c.18.492.361.984.554 1.459l.281.653c.177.421.355.841.545 1.245l.08.172c.166.35.34.697.513 1.037l1.401 2.514c.136.226.273.454.432.705l.217.335c.216.331.43.661.663.993l1.678 2.412 21.81-37.774H12.071z"  ></path></g></g></g></g></svg>',Be=[{type:"1",label:"aden",map1:async()=>Z(()=>import("./LUT_aden-BPNt8S6X.js"),[])},{type:"1",label:"crema",map1:async()=>Z(()=>import("./LUT_crema-Dr3xVYGh.js"),[])},{type:"2",label:"clarendon",map1:async()=>Z(()=>import("./LUT_clarendon1-UtcH-ItH.js"),[]),map2:async()=>Z(()=>import("./LUT_clarendon2-gqIK7yZD.js"),[])},{type:"3",label:"gingham",map1:async()=>Z(()=>import("./LUT_gingham1-XYBL9yCV.js"),[]),map2:async()=>Z(()=>import("./LUT_gingham_lgg-DKTq37Dx.js"),[])},{type:"1",label:"juno",map1:async()=>Z(()=>import("./LUT_juno-DAFSouMR.js"),[])},{type:"1",label:"lark",map1:async()=>Z(()=>import("./LUT_lark-CFq9A7h3.js"),[])},{type:"1",label:"ludwig",map1:async()=>Z(()=>import("./LUT_ludwig-B3y7u7o6.js"),[])},{type:"4",label:"moon",map1:async()=>Z(()=>import("./LUT_moon1-GzydTKI3.js"),[]),map2:async()=>Z(()=>import("./LUT_moon2-eVwlvPIO.js"),[])},{type:"1",label:"reyes",map1:async()=>Z(()=>import("./LUT_reyes-BfSRwpFg.js"),[])},{type:"MTX",label:"polaroid",mtx:"polaroid"},{type:"MTX",label:"kodak",mtx:"kodachrome"},{type:"MTX",label:"browni",mtx:"browni"},{type:"MTX",label:"vintage",mtx:"vintage"}];async function yt(e){const t=new Image;return t.src=e,await t.decode(),t}function mi(e,t,r){const o=t.filters;let i=G(!1);G(async()=>{if(e.value===null&&t.filters?.label){const s=Be.findIndex(d=>d.label===t.filters.label);c(s)}},{effect:!0});async function n(s){const d=document.getElementById("loader");d&&setTimeout(()=>d.style.display="",20);const u=Be[parseInt(s)];u.map1&&typeof u.map1=="function"&&(u.map1=await yt((await u.map1()).default)),u.map2&&typeof u.map2=="function"&&(u.map2=await yt((await u.map2()).default));const{type:l,mtx:f,map1:p,map2:v,label:h}=u;o.opt={type:l,mtx:f,map1:p,map2:v,label:h},d&&(d.style.display="none")}async function c(s){i.value!==s?(i.value=s,btn_reset_filters?.removeAttribute("disabled"),await n(s),r()):a()}function a(){btn_reset_filters?.setAttribute("disabled",!0),i.value=!1,o.opt=0,r()}return $`<style>.btn_insta{width:70px;color:light-dark(white,#fff);font-size:12px}</style><style>@keyframes animate{0.00%{animation-timing-function:cubic-bezier(0.51,0.03,0.89,0.56);transform:translate(0,0) rotate(0deg) scale(1,1) skew(0deg,0deg);opacity:1}52.00%{animation-timing-function:cubic-bezier(0.17,0.39,0.55,0.91);transform:translate(0,0) rotate(211.13deg)}100.00%{animation-timing-function:cubic-bezier(0.17,0.39,0.55,0.91);transform:translate(0,0) rotate(360deg)}}</style>${ne("filters",235,e,t,r,a,()=>$`<div id="loader" style="width:23px;fill:orange;display:none;position:absolute;top:-30px">${gi}</div>${Be.map((s,d)=>$`<button class="btn_insta" @click="${()=>c(d)}" :selected="${()=>i.value===d}">${s.label}</button>`)}`)}`}function xi(e,t,r){const o=t.blender,i=G(!o.blendmap),n=G("");function c(){o.$skip||(o.blendmap=0,o.blendmix=.5,l("blender_blendmix"),i.value=!0,n.value="",r&&r(),s("blender"))}function a(p,v,h){h&&(h.filename=v?.name,o.blendmap=h,n.value=v?.name,o.blendmix=.5,i.value=!1,r&&r(),s("blender"))}function s(p){const v=document.getElementById("btn_reset_"+p);o.blendmap===0?v&&v.setAttribute("disabled",!0):v&&v.removeAttribute("disabled")}function d(p){me("param",()=>u.call(this,p),30)}function u(p){const v=p.target.value,h=this.id.split("_");o[h[1]]=parseFloat(v),l(this.id),r(),s(h[0])}function l(p){const v=document.getElementById(p);if(!v)return;const h=p.split("_");v.value=o[h[1]],h.length===3?v.previousElementSibling.value=v.value:v.nextElementSibling.value=v.value}function f(){if(!this)return;const p=this.id.split("_");o[p[1]]=.5,l(this.id),r(),s(p[0])}return $`${ne("blender",100,e,t,r,c,$`<div>${()=>n.value?$`<input type="text" :value="${()=>n.value}" disabled="disabled" style="width:90%;margin-bottom:10px;padding-right:20px"> /* RANGE INPUT */<div style="display:flex;justify-content:space-around;align-items:center"><div class="rangelabel">blend mix</div><input id="blender_blendmix" style="width:130px" type="range" value="${o.blendmix}" min="0" max="1" step="0.01" @input="${d}" @dblclick="${f}" :disabled="${()=>i.value}"> <input id="blender_blendmix_" type="number" class="rangenumb" step="0.01" min="0" max="1" value="${o.blendmix}" @input="${d}" :disabled="${()=>i.value}"></div>`:$`${Ie("click or drop<br> to blend file","image/*",p=>Le(p,a),"width:90%; height:50px;")}`}</div>`)}`}function bi(e,t,r){const o={bokehstrength:0,bokehlensout:.5,gaussianstrength:0,centerX:.5,centerY:.5};c("blur")||a("blur");const i=G(!1);G(()=>{e.value==="blur"?(i.value=[[t.blur.centerX,t.blur.centerY]],de()):(i.value=!1,e.value===null&&d("blur"))},{effect:!0});function n(h){t.blur.centerX=h[0][0],t.blur.centerY=h[0][1],r()}function c(h){for(const x of Object.keys(o))if(!(x in t[h])||t[h][x]!==o[x])return!1;return!0}function a(h){for(const x of Object.keys(o))t[h][x]!==o[x]&&(t[h][x]=o[x],p(h+"_"+x))}function s(h){a(h),r(),d(h),i.value=!1,i.value=[[t.blur.centerX,t.blur.centerY]]}function d(h){const x=document.getElementById("btn_reset_"+h);x&&(c(h)?x.setAttribute("disabled",!0):x.removeAttribute("disabled"))}function u(h){h&&de(),r()}function l(h){me("param",()=>f.call(this,h),30)}function f(h){const x=h.target.value,w=this.id.split("_");t[w[0]][w[1]]=parseFloat(x),p(this.id),r(),d(w[0])}function p(h){const x=document.getElementById(h);if(!x)return;const w=h.split("_");x.value=t[w[0]][w[1]],w.length===3?x.previousElementSibling.value=x.value:x.nextElementSibling.value=x.value}function v(){if(!this)return;const h=this.id.split("_");t[h[0]][h[1]]=0,p(this.id),r(),d(h[0])}return $`${ne("blur",125,e,t,u,s,()=>$`/* mouse canvas */<style>.point{background-color:red!important;border:2px solid #ff8c00}</style>${()=>i.value&&It(canvas,i.value,n)} ${["bokehstrength","gaussianstrength","bokehlensout"].filter(h=>!h.startsWith("$")).map((h,x)=>$`/* RANGE INPUTS */<div style="display:flex;justify-content:space-around;align-items:center"><div class="rangelabel">${["bokeh strength","gauss strength","cirble radius"][x]}</div><input id="${"blur_"+h}" type="range" style="width:130px" value="${t.blur[h]}" min="0" max="1" step="0.01" @input="${l}" @dblclick="${v}"> <input id="${"blur_"+h+"_"}" type="number" class="rangenumb" value="${t.blur[h]}" min="0" max="1" step="0.01" @input="${l}"></div>`)}<div style="text-align:left;color:gray"><i>(center red dot)</i></div>`)}`}function yi(e,t,r){let o=!0;G(()=>{if(e.value==="recipes"){const a=i();Object.keys(a).length?o=!1:o=!0}},{effect:!0});function i(){const a={};return["colors","curve","lights","effects"].forEach(s=>{const d=Object.keys(t[s]).reduce((u,l)=>(t[s][l]&&(u[l]=t[s][l]),u),{});Object.keys(d).length&&(a[s]=d)}),(t.blur.bokehstrength||t.blur.gaussianstrength)&&(a.blur=t.blur),t.filters?.opt?.label&&(a.filters=t.filters.opt.label),a}async function n(){const a=i();if(!Object.keys(a).length)return;const s=G("recipe_"+new Date().toISOString().split("T")[0]+".json");if(!await Ct(()=>$`<div style="margin:10px 0"><div style="height:38px">Download recipe</div><div style="display:flex;flex-direction:column;font-size:14px"><div><input style="width:225px;font-size:14px" type="text" :value="${()=>s.value}" @change="${(f=>s.value=f.target.value)}"></div></div></div>`))return;const u=new TextEncoder().encode(JSON.stringify(a)),l=new Blob([u],{type:"application/json;charset=utf-8"});Wr(l,s.value)}async function c(){const a=await Rt("application/json");if(!a)return;const s=new FileReader;await new Promise(u=>s.onload=u,s.readAsText(a));const d=JSON.parse(s.result);["colors","curve","lights","effects","blur"].forEach(u=>{d[u]&&(t[u]={...t[u],...d[u]})}),d.filters&&(t.filters.label=d.filters),e.value=null,r()}return $`${ne("recipes",125,e,t,null,null,()=>$`<div><button @click="${c}">load</button> <button id="save_btn" @click="${n}" disabled="${o}">save</button></div><div><small>will save: <i>lights, colors, effects, curve, filters and blur</i></small></div>`)}`}function wi(e,t,r){const{top:o,left:i,width:n,height:c}=e.getBoundingClientRect();let a=e.width,s=e.height,d=n/a,u,l=!1,f,p=10;const v=t.heal.healmask||new Uint8Array(a*s).fill(0),h=new Uint8ClampedArray(a*s*4);for(var x=0;x<v.length;x++)h[x*4+0]=0,h[x*4+1]=190,h[x*4+2]=0,h[x*4+3]=v[x]?128:0;const w=new ImageData(h,a,s);oe(()=>{mousecontainer.addEventListener("pointerdown",m),mousecontainer.addEventListener("pointermove",g),mousecontainer.style.height=pannable.getBoundingClientRect().height+"px",mousecontainer.style.width=pannable.getBoundingClientRect().width+"px",mousecanvas.style.width=canvas.style.width,mousecanvas.style.height=canvas.style.height,u=mousecanvas.getContext("2d"),u.putImageData(w,0,0),editor.appendChild(mousecontainer)}),ce(()=>{mousecontainer.removeEventListener("pointerdown",m),mousecontainer.removeEventListener("pointermove",g),mousecontainer.remove()});function _(S,C,y){return Math.max(S,Math.min(y,C))}function E(S){let C=_(0,S.offsetX/n,1),y=_(0,S.offsetY/c,1);f=[C,y]}function m(S){l=!0,mousecontainer.setPointerCapture(S.pointerId),mousecontainer.addEventListener("pointerup",M),B()}function M(S){l=!1,mousecontainer.releasePointerCapture(S.pointerId),mousecontainer.removeEventListener("pointerup",M),r&&r(v)}function g(S){document.elementFromPoint(S.x,S.y).id==="mousecanvas"&&(l?(E(S),B()):(E(S),b()))}function b(){(!mousecursor.style.display||mousecursor.style.display==="none")&&(mousecursor.style.display="unset");const S=f,C=document.getElementById("mousecursor"),y=S[0]*n-C.offsetWidth/2+"px",T=S[1]*c-C.offsetHeight/2+"px";C.style.left!==y&&(C.style.left=y),C.style.top!==T&&(C.style.top=T)}function B(){const S=[Math.round(f[0]*a),Math.round(f[1]*s)];var C=Math.round(p/d);const y=Math.round(S[0]+S[1]*a);for(var T=-C;T<=C;T++)for(var R=-C;R<=C;R++)T*T+R*R<=C*C&&(v[y+T+R*a]=1,w.data[(y+T+R*a)*4+3]=128);u.putImageData(w,0,0),b()}return $`
        <style>
          #mousecontainer{position: fixed;top:${o}px;left:${i}px;width:${a}px;height:${s}px;}
          #mousecanvas{overflow:hidden;border:0px solid white;}
          #mousecursor{position:absolute;border:2px solid darkorange;border-radius:50%;width:${p*2}px;height:${p*2}px;pointer-events:none;display:none;}
        </style>
          <div id="mousecontainer">
            <canvas id="mousecanvas" width="${a}" height="${s}"></canvas>
            <div id="mousecursor"></div>
          </div>
    `}function Ci(e,t,r){G(()=>{e.value},{effect:!0});function o(u){t.heal.healmask=u,t.heal.healit=!0,r(),d("heal")}function i(){t.heal.healmask=null,t._minigl.resetImage(),r();const u=document.getElementById("mousecanvas");u&&u.getContext("2d").clearRect(0,0,u.width,u.height),e.value=null,e.value="heal"}const n=G("hide");function c(u){u.target.checked?(mousecanvas.style.opacity=1,n.value="hide"):(mousecanvas.style.opacity=0,n.value="show")}function a(u){return!t.heal.healmask}function s(u){i(),d(u)}function d(u){const l=document.getElementById("btn_reset_"+u);l&&(a()?l.setAttribute("disabled",!0):l.removeAttribute("disabled"))}return $`
    ${ne("heal",70,e,t,null,s,()=>$` 
        ${()=>wi(canvas,t,o)}
<style>
.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
}

.switch input { 
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  -webkit-transition: .4s;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  -webkit-transition: .4s;
  transition: .4s;
}

input:checked + .slider {
  background-color: light-dark(#b6b5b5,#191919);
}

input:focus + .slider {
  box-shadow: 0 0 1px light-dark(#b6b5b5,#191919);
}

input:checked + .slider:before {
  -webkit-transform: translateX(26px);
  -ms-transform: translateX(26px);
  transform: translateX(26px);
}

/* Rounded sliders */
.slider.round {
  border-radius: 34px;
}
.slider.round:before {
  border-radius: 50%;
}

</style>
        <div style="text-align:left; color:grey;">
          <label style="width:80px;display: inline-block;">${()=>n.value} mask:</label>
          <label class="switch" style="transform: scale(0.7);">
            <input type="checkbox" checked @change="${c}">
            <span class="slider round"></span>
          </label>
          <br>
        </div>
      `)}
  `}function Ce(e){this.cmp=e||function(t,r){return t-r},this.length=0,this.data=[]}Ce.prototype.peek=function(){return this.data[0]};Ce.prototype.push=function(e){this.data.push(e);for(var t=this.data.length-1,r,o;t>0&&(r=t-1>>>1,this.cmp(this.data[t],this.data[r])<0);)o=this.data[r],this.data[r]=this.data[t],this.data[t]=o,t=r;return++this.length};Ce.prototype.pop=function(){var e=this.data[0],t=this.data.pop();if(this.length--,this.data.length>0){this.data[0]=t;for(var r=0,o=this.data.length-1,i,n,c,a;i=(r<<1)+1,n=i+1,c=r,i<=o&&this.cmp(this.data[i],this.data[c])<0&&(c=i),n<=o&&this.cmp(this.data[n],this.data[c])<0&&(c=n),c!==r;)a=this.data[c],this.data[c]=this.data[r],this.data[r]=a,r=c}return e};function _i(e,t,r,o,i){i||(i=5);for(var n=1e6,c=1e-6,a=e*t,s=new Uint8Array(a),d=new Float32Array(a),u=0;u<a;u++)o[u]&&(s[u+1]=s[u]=s[u-1]=s[u+e]=s[u-e]=1);for(var u=0;u<a;u++)s[u]=s[u]*2-(o[u]^s[u]),s[u]==2&&(d[u]=n);for(var l=new Ce(function(M,g){return M[0]-g[0]}),u=0;u<a;u++)s[u]==1&&l.push([d[u],u]);for(var f=[],u=-i;u<=i;u++)for(var p=Math.floor(Math.sqrt(i*i-u*u)),v=-p;v<=p;v++)f.push(u+v*e);function h(M,g){var b=n,B=d[M],S=d[g];if(s[M]==0)if(s[g]==0){var C=Math.sqrt(2-(B-S)*(B-S)),y=(B+S-C)*.5;y>=B&&y>=S?b=y:(y+=C,y>=B&&y>=S&&(b=y))}else b=1+B;else s[g]==0&&(b=1+S);return b}function x(M){for(var g=0,b=0,B=w(d,M,1),S=w(d,M,e),C=M%e,y=Math.floor(M/e),T=0;T<f.length;T++){var R=M+f[T],P=R%e,A=Math.floor(R/e);if(!(P<=1||A<=1||P>=e-1||A>=t-1)&&s[R]==0){var L=C-P,U=y-A,J=1/((L*L+U*U)*Math.sqrt(L*L+U*U)),k=1/(1+Math.abs(d[R]-d[M])),I=Math.abs(L*B+U*S),F=J*k*I+c;g+=F*r[R],b+=F}}r[M]=g/b}function w(M,g,b){return s[g+b]!=2?s[g-b]!=2?(M[g+b]-M[g-b])*.5:M[g+b]-M[g]:s[g-b]!=2?M[g]-M[g-b]:0}for(;l.length;){var _=l.pop()[1],u=_%e,v=Math.floor(_/e);if(s[_]=0,!(u<=1||v<=1||u>=e-1||v>=t-1))for(var E=0;E<4;E++){var m=_+[-e,-1,e,1][E];s[m]!=0&&(d[m]=Math.min(h(m-e,m-1),h(m+e,m-1),h(m-e,m+1),h(m+e,m+1)),s[m]==2&&(s[m]=1,l.push([d[m],m]),x(m)))}}return r}const ki={appname:"MiNi PhotoEditor"};function de(){const e=document.getElementById("canvas"),t=document.getElementById("editor"),r=e.width/e.height;t.offsetWidth/r>t.offsetHeight?(e.style.height="99%",e.style.width=""):(e.style.width="99%",e.style.height=""),zoomable.style.transform="",pannable.style.transform=""}function $i(e=!1){q(ki);let t=!0;e?.sample===!1&&(t=!1);let r,o,i;const n=G(!1),c=G();let a={trs:{translateX:0,translateY:0,angle:0,scale:0,flipv:0,fliph:0},crop:{currentcrop:0,glcrop:0,canvas_angle:0,ar:0,arindex:0},lights:{brightness:0,exposure:0,gamma:0,contrast:0,shadows:0,highlights:0,bloom:0},colors:{temperature:0,tint:0,vibrance:0,saturation:0,sepia:0},effects:{clarity:0,noise:0,vignette:0},curve:{curvepoints:0},filters:{opt:0,mix:0},perspective:{quad:0,modified:0},perspective2:{before:0,after:0,modified:0},blender:{blendmap:0,blendmix:.5},resizer:{width:0,height:0},blur:{bokehstrength:0,bokehlensout:.5,gaussianstrength:0,gaussianlensout:.5,centerX:.5,centerY:.5},heal:{healmask:0}};async function s(k,I){if(k)try{let F,D,z,ee={name:I};if(typeof k=="string"&&k.startsWith("http")){const N=await fetch(k);if(N.status!==200)return console.error(await N.json());F=await N.arrayBuffer()}else if(k instanceof Image){const N=await fetch(k.src);if(N.error)return console.error(N.error);F=await N.arrayBuffer(),z=k}else if(k instanceof ArrayBuffer)F=k;else if(k instanceof Blob)D=k,F=await k.arrayBuffer();else return console.error("Unknown data type");ee.size=F.byteLength,D||(D=new Blob([F])),z||(z=new Image,z.src=URL.createObjectURL(D),await z.decode()),d(F,ee,z)}catch(F){console.error(F),await se(`<div style="margin:10px;text-wrap: auto;">${F}</div>`),history.back()}}e?.data&&s(e.data,e.name);async function d(k,I,F){n._value&&u();try{r=await Bt(k)}catch(z){console.error(z)}let D=r?.read();D||(D={}),D.xml&&(D.xml=D.xml.slice(D.xml.indexOf("<")).replace(/ +(?= )/g,"").replace(/\r\n|\n|\r/gm,"")),D.file={...I,hsize:Yr(I.size),width:F?.width||F?.videoWidth||"-",height:F?.height||F?.videoHeight||"-"},D.img=F,D.colorspace=D.icc?.ColorProfile?.[0].includes("P3")?"display-p3":"srgb",console.log("metadata",{...D}),n.value=D}function u(){w.value=null,C(),P(),y=.5;for(const k in a)for(const I in a[k])a[k][I]=0}G(()=>{if(c.value){const k=n._value;try{o?.destroy&&o.destroy(),o=Nr(document.getElementById("canvas"),k.img,k.colorspace),a._minigl=o,i&&i(),i=at(zoomable,pannable),l(),de()}catch(I){console.error(I)}}},{effect:!0});async function l(){if(o.loadImage(),a.heal.healit){const ee=a.heal.healmask,N=o.readPixels(),j=o.width,ae=o.height;for(var k=0;k<3;k++){for(var I=new Uint8Array(j*ae),F=0;F<N.length;F+=4)I[F/4]=N[F+k];_i(j,ae,I,ee);for(var D=0;D<I.length;D++)N[4*D+k]=I[D],k===0&&(N[4*D+3]=255)}const xe=new ImageData(new Uint8ClampedArray(N.buffer),j,ae);o.loadImage(xe),a.heal.healit=0}if((E||a.crop.glcrop)&&(a.trs.angle+=a.crop.canvas_angle,o.filterMatrix(a.trs),a.trs.angle-=a.crop.canvas_angle,a.perspective2.after)){let ee=a.perspective2.before.map(j=>[j[0]*canvas.width,j[1]*canvas.height]),N=a.perspective2.after.map(j=>[j[0]*canvas.width,j[1]*canvas.height]);o.filterPerspective(ee,N,!1,!1)}if(a.crop.glcrop)return o.crop(a.crop.glcrop),a.crop.glcrop=0,l();!a.blender.$skip&&a.blender.blendmap&&o.filterBlend(a.blender.blendmap,a.blender.blendmix);let z={};a.lights.$skip||(z={...z,...a.lights}),a.colors.$skip||(z={...z,...a.colors}),a.effects.$skip||(z={...z,...a.effects}),o.filterAdjustments({...z}),z.bloom&&o.filterBloom(z.bloom),z.noise&&o.filterNoise(z.noise),(z.shadows||z.highlights)&&o.filterHighlightsShadows(z.highlights||0,-z.shadows||0),!a.curve.$skip&&a.curve.curvepoints&&o.filterCurves(a.curve.curvepoints),!a.filters.$skip&&a.filters.opt&&o.filterInsta(a.filters.opt,a.filters.mix),!a.blur.$skip&&a.blur.bokehstrength&&o.filterBlurBokeh(a.blur),!a.blur.$skip&&a.blur.gaussianstrength&&(a.blur.gaussianlensout=a.blur.bokehlensout,o.filterBlurGaussian(a.blur)),o.paintCanvas(),b&&b()}function f(k){k?.preventDefault(),de()}let p=0;function v(k){if(k.preventDefault(),p&&Date.now()-p<200)return f(k);p=Date.now()}function h(k){k.preventDefault(),w.value=""}async function x(k){k?.stopPropagation();const I=n.value;await se(()=>$`<div style="text-align:left;font-size:12px;max-height:50vh;overflow:auto"><div class="section">FILE</div><div>name: ${I.file.name}</div><div>size: ${I.file.width} x ${I.file.height} (${I.file.hsize})</div><div>date: ${I.exif?.DateTimeOriginal?.value||new Date(I.file.lastModified).toLocaleString("en-UK")}</div><div>prof: ${I.colorspace}</div>${I.tiff&&$`<div class="section">TIFF</div>`} ${I.tiff&&Object.entries(I.tiff).sort((F,D)=>F[0]?.toString().localeCompare(D[0]?.toString())).map(F=>$`<div>${F[0]}: ${F[1].hvalue||F[1].value}</div>`)} ${I.gps&&$`<div class="section">GPS</div>`} ${()=>I.gps&&ri([I.gps.GPSLongitude.hvalue,I.gps.GPSLatitude.hvalue])} ${I.exif&&$`<div class="section">EXIF</div>`} ${I.exif&&Object.entries(I.exif).sort((F,D)=>F[0]?.toString().localeCompare(D[0]?.toString())).map(F=>$`<div>${F[0]}: ${F[1].hvalue||F[1].value}</div>`)}</div>`,400)}const w=G();let _=null;G(()=>{w.value==="composition"?m():_==="composition"&&M(),_=w.value},{effect:!0});let E=!1;function m(){P(),C(),de(),E=!0,btn_info.setAttribute("disabled",!0),btn_histo.setAttribute("disabled",!0),btn_split.setAttribute("disabled",!0),i&&i()}function M(){E=!1,btn_info.removeAttribute("disabled"),btn_histo.removeAttribute("disabled"),btn_split.removeAttribute("disabled"),i=at(zoomable,pannable)}function g(){Object.values(a.trs).reduce((k,I)=>k+=I,0)===0&&Object.values(a.crop).reduce((k,I)=>k+=I,0)===0&&a.perspective2.modified==0&&a.resizer.width===0?btn_reset_composition.setAttribute("disabled",!0):btn_reset_composition.removeAttribute("disabled")}let b;const B=G(!1);function S(k){k?.stopPropagation(),!E&&(B.value?B.value=!1:B.value=!0)}function C(){B.value=!1}let y,T;const R=G(!1);function P(){R.value=!1}function A(k){k?.stopPropagation(),!E&&(R._value?R.value=!1:(T=o.img_cropped||o.img,R.value=!0))}function L(k){y=k}async function U(){await se(k=>$`<div style="position:relative;height:250px;overflow:auto"><img id="snail.jpg" @click="${J}" style="cursor:pointer;position:absolute;top:50px;left:20px;border-radius:10px" src="/samples/snail-8577681_1280.jpg" title="jpg" width="130"> <img id="seagull.png" @click="${J}" style="cursor:pointer;position:absolute;top:50px;left:160px;border-radius:10px" src="/samples/seagull-8547189_1280.png" title="png" width="150"> <img id="water.jpg" @click="${J}" style="cursor:pointer;position:absolute;top:145px;left:160px;border-radius:10px" src="/samples/water-8100724_1280.jpg" title="jpg" width="150"> <img id="perspective.jpg" @click="${J}" style="cursor:pointer;position:absolute;top:50px;left:320px;border-radius:10px" src="/samples/perspective2.jpg" title="jpg" width="137"></div>`,460)}function J(){s(this.src,this.id),root.lastElementChild.remove()}return $`<div class="minieditor"><div class="app">/******** LOADING PAGE ********/ ${()=>!n.value&&!e.data&&$`<div class="main" style="justify-content:center"><img src="${it}" width="130" alt="logo"><h1>${q("appname")}</h1><div>${Ie("click or drop<br> to load file","image/*",k=>Le(k,d),"height: 120px;")} ${t&&$`<button style="height:80px;width:80px" @click="${U}">sample images</button>`}</div><div style="font-size:13px;color:gray;margin-top:20px"><i>100% private and offline!<br>100% free and opensource <a style="font-size:10px" href="https://github.com/xdadda/mini-photo-editor" target="_blank"><img src="${ot}" style="width:15px"></a></i></div></div>`} /******** IMGEDITOR PAGE ********/ ${()=>n.value&&$`${e?'<div class="header" style="backdrop-filter: unset;"></div>':$`<div class="header"><div class="banner"><img src="${it}" width="30" alt="logo"> ${q("appname")}</div><div></div><div style="display:flex"><div class="btn_fullscreen">${()=>Qr(null)}</div><div class="btn_theme">${()=>qr("dark",!0)}</div></div></div>`}<div class="main"><div class="container"><div id="editor" class="editor"><div id="zoomable" @dblclick="${f}" @click="${v}"><div id="pannable">/******** PAINT CANVAS *******/<canvas :ref="${c}" id="canvas" class="checkered"></canvas>/******** SPLIT VIEW *******/ ${()=>R.value&&oi(T,canvas.style.width,canvas.style.height,y,L)} /******** CROP CANVAS *******/ ${()=>w.value==="composition"&&ii(canvas,a,g)}</div></div></div><div class="sidebar" @click="${h}"><div class="menubuttons"><div style="display:flex;align-items:center;justify-content:center">${!e?.data&&$`${Ie("open","image/*",k=>Le(k,d),"width:105px;height:30px;")}`} ${!!e?.data&&$`<button style="width:105px;height:30px" @click="${()=>e.cb()}">cancel</button>`} <button style="width:105px;height:30px" id="btn_download" @click="${()=>{w.value="",ai(n,r,o,e?.cb||null)}}">${e?.data?"save":"download"}</button></div><div style="display:flex;align-items:center;justify-content:center"><button style="width:70px;height:30px;fill:white" id="btn_info" @click="${x}" title="file info"><div style="scale:0.35;margin-top:-15px">${jr}</div></button> <button style="width:70px;height:30px;fill:white" id="btn_histo" @click="${S}" :selected="${()=>B.value}" tile="histogram"><div style="scale:0.4;margin-top:-15px">${Hr}</div></button> <button style="width:70px;height:30px;fill:white" id="btn_split" @click="${A}" :selected="${()=>R.value}" tile="splitview"><div style="scale:0.5;margin-top:-15px">${Xr}</div></button></div></div><div class="menusections">/******** COMPOSITION *******/ ${ui(w,a,l,()=>o,de)} /******** PERSPECTIVE *******/ /******** ADJUSTMENTS *******/ ${fi(w,a,l)} /******** COLOR CURVE *******/ ${pi(w,a,l)} /******** FILTERS *******/ ${mi(w,a,l)} /******** BLENDER *******/ ${xi(w,a,l)} /******** BLUR *******/ ${bi(w,a,l)} /******** RECIPES *******/ ${yi(w,a,l)} /******** HEAL BRUSH *******/ ${Ci(w,a,l)}</div></div></div>/******** HISTOGRAM *******/ ${()=>B.value&&ti(n._value.colorspace,k=>{b=k,l()})}</div>`}<div class="footer"><a style="margin-right:10px;font-size:10px" href="https://github.com/xdadda/mini-photo-editor" target="_blank"><img src="${ot}" style="width:15px"></a></div></div></div>`}await Te(document.getElementById("root"),$i,!0);
