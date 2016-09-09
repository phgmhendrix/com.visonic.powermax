"use strict";

const powermax = require('powermax-api');
const triggers = [ 'zonealarm', 'panelalarm', 'paneltrouble', 'battery' ]; // triggers that need state check


// Handler for open zones question
function openZoneSpeechHandler(id, speech) {
	// Check for each alarm panel
	var panels = powermax.getPanels();
	for (var p = 0; p < panels.length; p++) {
		var id = panels[p].id;
		var name = panels[p].hname;
		var openz = powermax.getOpenZones(id);
		var cnt = openz.length;
		var zones = '';
		for (var i in openz) {
			zones += openz[i].name + ', ';
		}
		if (cnt == 0) {
			var txt = __('speech.no_open_zone', { panel: name });
			powermax.debug(txt);
			Homey.manager('speech-output').say(txt, speech);
		} else {
			zones = zones.slice(0, -2); // remove last ', ';
			var txt;
			if (cnt == 1) {
				txt = __('speech.open_zone', {  panel: name, zone: zones });
			} else {
				txt = __('speech.open_zones', {  panel: name, cnt: cnt, zones: zones });
			}
			powermax.debug(txt);
			Homey.manager('speech-output').say(txt, speech);
		}
	}
}

// Default handler for speech input: talk back
function defaultSpeechHandler(idx, speech) {
	// Check for each alarm panel
	var panels = powermax.getPanels();
	for (var p = 0; p < panels.length; p++) {
		var id = panels[p].id;
		var name = panels[p].hname;
		var func = speechTriggers[idx].check;
		var result = func(id);
		var cnt = result.length;
		var items = '';
		for (var i in result) {
			items += result[i].name + ', ';
		}
		var word = 'speech.' + speechTriggers[idx].word;
		if (cnt == 0) {
			var txt = __(word + '.none', { panel: name });
			powermax.debug(txt);
			Homey.manager('speech-output').say(txt, speech);
		} else {
			items = items.slice(0, -2); // remove last ', ';
			var txt;
			if (cnt == 1) {
				txt = __(word + '.one', {  panel: name, item: items });
			} else {
				txt = __(word + '.more', {  panel: name, cnt: cnt, items: items });
			}
			powermax.debug(txt);
			Homey.manager('speech-output').say(txt, speech);
		}
	}
}

// statusSpeechHandler
function statusSpeechHandler(idx, speech) {
	const flags = [ 'ready', 'trouble', 'alarm', 'memory' ];
	// Check for each alarm panel
	var panels = powermax.getPanels();
	for (var p = 0; p < panels.length; p++) {
		var id = panels[p].id;
		var name = panels[p].hname;
		var result = powermax.getPanelStatus(id);
		powermax.debug(result);
		if (result != null) {
			var txt = __('speech.status.general', { panel: name, status: result.status.txt });
			powermax.debug(txt);
			Homey.manager('speech-output').say(txt, speech);
			// Check how many zones are open
			var opencnt = powermax.getOpenZones(id).length;
			var state = [];
			if (opencnt == 1) {
				state.push(__('speech.status.open.one'));
			} else if (opencnt > 1) {
				state.push(__('speech.status.open.more', { cnt: opencnt }));
			}
			for (var i = 0; i < flags.length; i++) {
				if (result[flags[i]]) {
					state.push(__('speech.status.' + flags[i]));
				}
			}
			if (state.length > 0) {
				txt = state.join(__('speech.status.and'));
				// Make a neat sentence
				txt = txt[0].toUpperCase() + txt.slice(1) + '.';
				powermax.debug(txt);
				Homey.manager('speech-output').say(txt, speech);
			}
		}
	}
}

// Trouble handler
function troubleSpeechHandler(idx, speech) {
	const items = [ 'panel', 'alarm', 'battery', 'tamper' ];
	// Check for each alarm panel
	var panels = powermax.getPanels();
	for (var p = 0; p < panels.length; p++) {
		var id = panels[p].id;
		var name = panels[p].hname;
		var result = powermax.getPanelTrouble(id);
		powermax.debug(result);
		var state = [];
		for (var i in items) {
			var elem = result[items[i]];
			powermax.debug(i, elem);
			if (elem != null && elem.length > 0) {
				var x = [];
				for (var j = 0; j < elem.length; j++) {
					x.push(elem[j].txt);
				}
				var cnt = x.length;
				x.join(__('speech.status.and'));
				powermax.debug(x);
				if (items[i] == 'panel') {
					state.push(__('speech.trouble.panel', { panel: name }) + x);
				} else {
					var nr = (cnt == 1 ? 'one' : 'more');
					state.push(__('speech.trouble.sensor.' + nr, { panel: name, type: items[i], sensor: x }));
				}
			}
		}
		var txt = __('speech.trouble.none', { panel: name });
		if (state.length > 0) {
			var txt = state.join(__('speech.status.and'));
			// Make a neat sentence
			txt = txt[0].toUpperCase() + txt.slice(1) + '.';
		}
		powermax.debug(txt);
		Homey.manager('speech-output').say(txt, speech);
	}
}

// Speech ids and actions
const speechTriggers = [
	{ says: ['open', 'zone'], check: powermax.getOpenZones,	word: 'open' },
	{ says: ['panel', 'status' ], handler: statusSpeechHandler },
	{ says: ['panel', 'trouble' ], handler: troubleSpeechHandler }
]


// Start of the app
function init() {
	Homey.log("Starting PowerMax app!");

	// Catch triggers
	for (var i = 0; i < triggers.length; i++) {
		Homey.manager('flow').on('trigger.' + triggers[i], function(callback, args, state) {
			var result = (state.state == false) != (args.values == 'on');
			powermax.debug('>> Checked action ' + triggers[i] + ' for ' + state.state + ' = ' + args.values + ', result = ' + result);
			callback(null, result);
		});
	}
	
	// Check conditions
	Homey.manager('flow').on('condition.sysflags', function(callback, args) {
		var id = args.device.id;
		var check = powermax.getPanelValue(id, args.flag);
		callback(null, check);
	});
	
	// Register actions
	Homey.manager('flow').on('action.setClock', function(callback, args) {
		powermax.debug('Action setClock ' + args.device.id);
		var ok = powermax.setClock(args.device.id);
		callback(null, ok);
	});
	
	// Register speech actions
	Homey.manager('speech-input').on('speech', function(speech, callback) {
		var matched = false;
		powermax.debug('Received speech trigger');
		for (var i = 0; i < speechTriggers.length; i++) {
			var match = 0;
			speech.triggers.forEach(function(trigger) {
				for (var m = 0; m < speechTriggers[i].says.length; m++) {
					if (trigger.id == speechTriggers[i].says[m]) {
						match++;
					}
				}
			});
			matched = match == speechTriggers[i].says.length;
			if (matched) {
				powermax.debug('Match on ' + speechTriggers[i].says);
				var handler = speechTriggers[i].handler || defaultSpeechHandler;
				handler(i, speech);
			}
		}
		callback(matched ? null : true, matched ? true : null);
	});
}


var api = {
}

module.exports = { 
	init: init,
	api: api
}