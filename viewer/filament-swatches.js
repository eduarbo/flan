// SPDX-License-Identifier: GPL-3.0-or-later
// Published 1.75 mm PLA color tables. Catalog inclusion does not imply local stock.
export const matteSource='https://bambulab-us.myshopify.com/products/pla-matte';
export const basicSource='https://bambulab-us.myshopify.com/products/pla-basic-filament';
const matte={
 'Ivory White':'#FFFFFF','Bone White':'#CBC6B8','Latte Brown':'#D3B7A7',
 Caramel:'#AE835B',Terracotta:'#B15533','Desert Tan':'#E8DBB7','Ash Gray':'#9B9EA0',
 'Nardo Gray':'#757575','Lilac Purple':'#AE96D4','Sakura Pink':'#E8AFCF',Plum:'#950051',
 'Mandarin Orange':'#F99963','Lemon Yellow':'#F7D959','Scarlet Red':'#DE4343',
 'Dark Red':'#BB3D43','Dark Brown':'#7D6556','Dark Chocolate':'#4D3324','Dark Green':'#68724D',
 'Apple Green':'#C2E189','Grass Green':'#61C680','Ice Blue':'#A3D8E1','Sky Blue':'#56B7E6',
 'Marine Blue':'#0078BF','Dark Blue':'#042F56',Charcoal:'#000000'
};
const basic={
 'Jade White':'#FFFFFF',Beige:'#F7E6DE',Gold:'#E4BD68',Silver:'#A6A9AA',Gray:'#8E9089',Bronze:'#847D48',
 Brown:'#9D432C','Cocoa Brown':'#6F5034','Maroon Red':'#9D2235',Red:'#C12E1F',Magenta:'#EC008C',
 Pink:'#F55A74','Hot Pink':'#F5547C',Orange:'#FF6A13','Pumpkin Orange':'#FF9016','Sunflower Yellow':'#FEC600',
 Yellow:'#F4EE2A','Bright Green':'#BECF00','Bambu Green':'#00AE42','Mistletoe Green':'#3F8E43',Turquoise:'#00B1B7',
 Cyan:'#0086D6',Blue:'#0A2989','Cobalt Blue':'#0056B8',Purple:'#5E43B7','Indigo Purple':'#482960',
 'Blue Gray':'#5B6579','Light Gray':'#D1D3D5','Dark Gray':'#545454',Black:'#000000'
};
const panchromaMatte={
 'Charcoal Black':'#2F2E30','Cotton White':'#F4EFEB','Army Beige':'#DBBAA5','Army Brown':'#795A4D','Earth Brown':'#7C594A','Muted White':'#BBADA4','Pastel Peanut':'#BF9573','Wood Brown':'#AB7449','Pastel Peach':'#F6BF8B','Sunrise Orange':'#F88B17','Pastel Banana':'#F7D475','Army Light Green':'#AB8C02','Savannah Yellow':'#F3C432','Lime Green':'#D7D602','Army Dark Green':'#5F6244','Pastel Mint':'#D2DEBB','Muted Green':'#777E71','Forest Green':'#60AD70','Arctic Teal':'#61BCC3','Pastel Ice':'#A4D0DF','Sapphire Blue':'#0163A6','Army Blue':'#2E4462','Muted Blue':'#5F778E','Fossil Grey':'#8A8C94','Lavender Purple':'#9572BF','Muted Purple':'#7C5C78','Pastel Candy':'#F0D6D9','Sakura Pink':'#EAADBD','Pastel Watermelon':'#EE474B','Lava Red':'#ED2F2E','Army Red':'#BF312E','Muted Red':'#D84B2E','Army Purple':'#36364A','Ash Grey':'#485155','Electric Indigo':'#6858A9','Pastel Periwinkle':'#ADB4E6','Lotus Pink':'#DD76C0','Sky Blue':'#1AC5FC','Sunshine Yellow':'#F9DA07','Grass Green':'#32BC46','Seafoam Green':'#7DD4BE','Raspberry Blue':'#5472D0','Wine Burgundy':'#753E4C','Emerald Green':'#22624F','Muted Moss':'#92864F','Muted Teal':'#5D989E','Muted Mauve':'#A36D82','Muted Terracotta':'#C06443','Pastel Coral':'#F09A7E','Pastel Beige':'#E4D0B0','Electric Magenta':'#F05B8F'
};
const panchromaBasic={
 Black:'#080A0D',White:'#EBF7FF','Cold White':'#D9DFE5',Red:'#E72F1D',Orange:'#F67405',Magenta:'#F24574',Pink:'#F1A1AF','Wine Red':'#D60212','Lemon Yellow':'#EED230',Yellow:'#FFE800',Cream:'#EED1A8',Beige:'#C2AB72',Tan:'#A79E82',Brown:'#55331A',Green:'#06924D','Lime Green':'#D5D701','Jungle Green':'#4E742D','Olive Green':'#948902','Dark Olive Drab':'#575B54','Azure Blue':'#0066D9',Blue:'#003776','Aqua Blue':'#5EBDDB','Stone Blue':'#487BA2','Polymaker Teal':'#4CC0C7','Steel Grey':'#616469',Grey:'#8C9099','Dark Grey':'#485259',Purple:'#6C47B2'
};
export const swatchSources={
 'Bambu PLA Matte':matteSource,'Bambu PLA Basic':basicSource,
 'Polymaker Panchroma Matte':'https://shop.polymaker.com/products/matte-pla',
 'Polymaker Panchroma Basic':'https://shop.polymaker.com/products/panchroma-pla'
};
function oklab(hex){
 const [r,g,b]=hex.slice(1).match(/../g).map(pair=>{
  const n=parseInt(pair,16)/255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;
 });
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b);
 const m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b);
 const s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
// Keep named colors under the family printed on the spool. For names such as
// Periwinkle and Mauve, use the manufacturer's swatch in perceptual color space.
const namedFamilies=[
 ['neutral',/white|black|gr[ae]y|charcoal|silver/i],['pink',/pink|magenta|sakura/i],
 ['purple',/purple|indigo|lavender|plum/i],['brown',/brown|beige|tan$|caramel|terracotta|chocolate/i],
 ['red',/red|burgundy/i],['orange',/orange/i],['yellow',/yellow|gold/i],
 ['teal',/teal|turquoise|aqua|cyan/i],['green',/green|olive/i],['blue',/blue/i]
];
export function hueFamily(spool){
 const named=namedFamilies.find(([,label])=>label.test(spool.name));
 if(named)return named[0];
 const [light,a,b]=spool.lab,chroma=Math.hypot(a,b),hue=(Math.atan2(b,a)*180/Math.PI+360)%360;
 if(chroma<.035)return 'neutral';
 if(hue>30&&hue<90&&light<.63&&chroma<.15)return 'brown';
 if(hue<25||hue>=355)return 'red';
 if(hue<73)return 'orange';
 if(hue<115)return 'yellow';
 if(hue<165)return 'green';
 if(hue<220)return 'teal';
 if(hue<285)return 'blue';
 if(hue<330)return 'purple';
 return 'pink';
}
const ranges={'Bambu PLA Matte':matte,'Bambu PLA Basic':basic,'Polymaker Panchroma Matte':panchromaMatte,'Polymaker Panchroma Basic':panchromaBasic};
export const catalogSpools=Object.entries(ranges).flatMap(([series,colors])=>{
 const brand=series.startsWith('Bambu ')?'Bambu Lab':'Polymaker';
 const line=series.slice(series.indexOf(' ')+1),finish=series.endsWith(' Matte')?'matte':'basic';
 return Object.entries(colors).map(([name,hex])=>({id:series+'/'+name,name,series,brand,line,finish,hex,lab:oklab(hex)}));
});
const byId=new Map(catalogSpools.map(s=>[s.id,s]));
export const spoolById=id=>byId.get(id);
export const spoolFor=(config,side,hex)=>spoolById(config.filaments?.[side]?.[hex.toLowerCase()]);
export function commonSpool(config,sides,hex){
 const first=spoolFor(config,sides[0],hex);
 return first&&sides.every(side=>spoolFor(config,side,hex)===first)?first:undefined;
}
export function rankedSwatches(hex){
 const target=oklab(hex);
 const distance=s=>s.lab.reduce((sum,v,i)=>sum+(v-target[i])**2,0);
 return catalogSpools.map(spool=>({spool,d:distance(spool)})).sort((a,b)=>a.d-b.d).map(x=>x.spool);
}
export const closestSwatch=hex=>rankedSwatches(hex)[0];
export function bindSpool(config,sides,spool){
 config.filaments??={};
 for(const side of sides){config.filaments[side]??={};config.filaments[side][spool.hex.toLowerCase()]=spool.id;}
 return config;
}
export function colorFields(config,side){
 const cs=config.cases[side],frame=config.frames[side];
 return [[cs,'base_color','base'],[cs,'plate_color','plate'],[frame,'color','frame'],...Object.keys(frame.accents).map(k=>[frame.accents,k,k]),...Object.values(config.keycaps[side]).map(k=>[k,'color','keycaps'])];
}
export function mapThemeToSpools(config,sides,choose){
 const next=JSON.parse(JSON.stringify(config));
 for(const side of sides){
  for(const [record,key] of colorFields(next,side)){
   const hex=record[key].toLowerCase(),spool=choose(hex,side);
   if(spool){record[key]=spool.hex.toLowerCase();bindSpool(next,[side],spool);}
  }
 }
 return next;
}
export const modes=['ams','object','manual'];
export const setupOf=config=>({mode:config.print_setup?.mode||'ams',bed:config.print_setup?.bed||256});
