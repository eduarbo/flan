// SPDX-License-Identifier: GPL-3.0-or-later
import catalog from '../design/bambu-presets.json' with {type:'json'};

export const printerModels=catalog.models;
export const printerFor=name=>Object.hasOwn(printerModels,name)?printerModels[name]:null;
export const printerSuffix=setup=>setup.printer?'-'+setup.printer.replaceAll(' ','-')+'-'+setup.nozzle+'mm':'';

export function printSettings(setup,spools){
 const machine=printerFor(setup.printer),profile=machine?.nozzles[setup.nozzle];
 const bed=machine?.bed??setup.bed,diameter=setup.nozzle??'0.4';
 const materials=spools.map(spool=>Object.hasOwn(catalog.filamentIds,spool.series)?spool.series:'Generic PLA');
 const settings={
  version:'02.00.00.00',printer_technology:'FFF',printer_model:machine?'Bambu Lab '+setup.printer:'',
  printer_settings_id:profile?.machine??'',print_settings_id:profile?.process??'',
  printable_area:['0x0',bed+'x0',bed+'x'+bed,'0x'+bed],printable_height:String(machine?.height??Math.min(250,bed)),
  nozzle_diameter:Array(machine?.extruders??1).fill(diameter),
  filament_colour:spools.map(s=>s.color),filament_settings_id:materials.map(m=>profile?.materials[m]??'Generic PLA'),
  filament_type:spools.map(()=>'PLA'),filament_diameter:spools.map(()=>'1.75'),filament_is_support:spools.map(()=>'0')
 };
 if(profile){
  settings.printer_variant=diameter;
  settings.filament_ids=materials.map(m=>catalog.filamentIds[m]);
 }
 return settings;
}
