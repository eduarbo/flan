// SPDX-License-Identifier: GPL-3.0-or-later
// The assembly of one half, in the order it is done. Each step lists only what it adds:
// its pictures, the parts to pick up and what to do with them. The saved plan prints the same steps.
export function assemblySteps({cover,common,structural,keys},say){
 const hardware=common?'-common':'';
 return [
  {title:say('Battery and PCB','Batería y PCB'),
   views:[['battery-stack',say('Base, locator, battery, cage and PCB','Base, guía, batería, jaula y PCB')]],
   parts:[['locator'],['battery'],['cage'],['tape']],
   steps:[
    say('Unplug USB and the battery. Check that the battery has the size and charge rating of your design.','Desconecta el USB y la batería. Comprueba que la batería tenga el tamaño y el límite de carga de tu diseño.'),
    say('Seat the locator in the base and lay the battery inside it, on the base floor.','Asienta la guía en la base y coloca la batería dentro, sobre el piso de la base.'),
    say('Place the cage over the battery. Keep the wires clear of the posts and tape any exposed edge, without pressing on the battery.','Cubre la batería con la jaula. Aleja los cables de los postes y aísla con cinta los bordes expuestos, sin presionar la batería.'),
    say('Lower the PCB onto the cage feet.','Baja la PCB sobre los pies de la jaula.')]},
  {title:say('Screws and plate','Tornillos y placa'),
   views:[['board-screws',say('PCB · 2 short screws','PCB · 2 tornillos cortos')],
    ['plate-screws',say('Spacers, plate and '+structural+' long screws','Separadores, placa y '+structural+' tornillos largos')]],
   parts:[['m4'+hardware,2],['spacer',structural],['plate'],['m6'+hardware,structural],['driver']],
   steps:[
    say('Fasten the PCB with the two short M2 × 4 mm screws.','Fija la PCB con los dos tornillos cortos M2 × 4 mm.'),
    say('Set a printed spacer on each of the '+structural+' posts and lower the switch plate onto them.','Pon un separador impreso en cada uno de los '+structural+' postes y baja la placa de switches sobre ellos.'),
    say('Fasten the plate with the '+structural+' long M2 × 6 mm screws.','Atornilla la placa con los '+structural+' tornillos largos M2 × 6 mm.')],
   note:say('Avoid countersunk, self-tapping or longer screws.','Evita los tornillos avellanados, autorroscantes o más largos.')+
    (common?say(' With common M2 machine screws, use heads up to Ø4 × 2 mm and a 1.5 mm hex key for socket caps.',' Con tornillos de máquina M2 comunes, usa cabezas de hasta Ø4 × 2 mm y una llave Allen de 1.5 mm para los de cabeza cilíndrica.'):'')},
  {title:say('Switches and keycaps','Switches y teclas'),
   views:[['key-stack',say('Switch through the plate, keycap on its stem','Switch a través de la placa y tecla sobre su vástago')]],
   parts:[['switch',keys/2],['keycap',keys/2]],
   steps:[
    say('Check that the pins of each switch are straight.','Comprueba que los pines de cada switch estén rectos.'),
    say('Press the switch straight through the plate until it seats in its socket on the PCB.','Presiona el switch recto a través de la placa hasta que asiente en su zócalo de la PCB.'),
    say('Press a keycap onto each stem.','Encaja una tecla sobre cada vástago.')]},
  {title:say('Battery connector','Conector de batería'),
   views:[['battery-port',say('J1 takes the battery plug. SW1 is the power switch: on is toward the USB end on the right half and toward the thumb keys on the left half.','J1 recibe el enchufe de la batería. SW1 es el interruptor: enciende hacia el extremo del USB en la mitad derecha y hacia las teclas de pulgar en la izquierda.')]],
   parts:[['nano'],['plug'],['meter']],
   steps:[
    say('Unplug USB and switch SW1 off.','Desconecta el USB y apaga SW1.'),
    say('If you removed the controller after the USB test, seat it again.','Si retiraste el controlador tras la prueba por USB, vuelve a asentarlo.'),
    say('Measure the battery plug with the multimeter: its positive contact must meet pin 1 of J1, BAT+. Do not go by the wire colors, and do not plug it in if they differ.','Mide el enchufe de la batería con el multímetro: su contacto positivo debe coincidir con el pin 1 de J1, BAT+. No te guíes por el color de los cables y no la conectes si no coinciden.'),
    say('The Typeractive 301230 we tested arrived with its plug reversed for this board. If yours is too, swap its two wires in the plug: lift each terminal latch with a pin, pull the wire out, put them back crossed and measure again.','La Typeractive 301230 que probamos llegó con el enchufe invertido para esta placa. Si la tuya también, intercambia sus dos cables en el enchufe: levanta la pestaña de cada terminal con una aguja, saca el cable, vuelve a meterlos cruzados y mide de nuevo.'),
    say('Plug the battery into J1 while J1 is still within reach.','Conecta la batería a J1 mientras J1 sigue accesible.')]},
  {title:cover?say('Display and frame','Pantalla y marco'):say('Display','Pantalla'),
   views:[['display-stack',cover?say('Display onto its support, then the frame','La pantalla sobre su soporte y después el marco'):say('Display onto its support and socket','La pantalla sobre su soporte y su zócalo')]],
   parts:[['view'],['view-socket'],['sled'],...(cover?[['frame']]:[])],
   steps:[
    say('Guide the five display pins straight into their socket until the display rests on its printed support.','Introduce los cinco pines de la pantalla rectos en su zócalo, hasta que la pantalla descanse en su soporte impreso.'),
    ...(cover?[say('Lower the frame over it. It rests in place, loose; a frame that grips the display is being redesigned. Check that it does not press on the glass.','Baja el marco sobre ella. Queda apoyado, sin sujeción; el marco que se sujeta al display está en rediseño. Comprueba que no presione el vidrio.')]:[])]},
  {title:say('Feet and final test','Patas y prueba final'),
   views:[['base-feet',say('Base, seen from underneath','Base, vista desde abajo')]],
   parts:[['feet',4]],
   steps:[
    say('Stick the four feet underneath, clear of the reset hole and the screws.','Pega las cuatro patas debajo, sin tapar el orificio de reset ni los tornillos.'),
    say('Check that the USB-C port is within reach and that every key goes down and comes back freely.','Comprueba que el puerto USB-C quede accesible y que cada tecla baje y regrese libremente.'),
    say('Switch it on and test charging over USB, within the battery rating. Stop if anything gets unexpectedly hot.','Enciéndela y prueba la carga por USB dentro del límite de la batería. Detente si algo se calienta de forma inesperada.'),
    say('Pair the left half, then test both: all '+keys+' keys, chords, thumb tap and hold, the four layers, reconnecting, and waking after 15 minutes.','Empareja la mitad izquierda y prueba ambas: las '+keys+' teclas, combinaciones, tap y hold de pulgares, las cuatro capas, la reconexión y el despertar tras 15 minutos.'),
    cover?say('Check that lifting the frame still gives access to the battery plug.','Comprueba que, al levantar el marco, el enchufe de la batería siga accesible.')
     :say('Check that the battery plug is still within reach.','Comprueba que el enchufe de la batería siga accesible.')]}
 ];
}
