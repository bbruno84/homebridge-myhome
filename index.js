var path = require("path");	
var mh = require(path.join(__dirname,'/lib/mhclient'));
var sprintf = require("sprintf-js").sprintf, inherits = require("util").inherits, Promise = require('promise');
var events = require('events'), util = require('util'), fs = require('fs');
var Accessory, Characteristic, Service, UUIDGen;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	Accessory = homebridge.platformAccessory;
	UUIDGen = homebridge.hap.uuid;

	inherits(MHRelay, Accessory);
	process.setMaxListeners(0);
	homebridge.registerPlatform("homebridge-myhome", "LegrandMyHome", LegrandMyHome);
	// homebridge.registerAccessory('homebridge-myhome-relay', 'MHRelay', MHRelay);
};

class LegrandMyHome {
	constructor(log, config, api) {
		this.log = log;
		this.config = config || {};
		this.api = api;
		this.log.info("LegrandMyHome for MyHome Gateway at " + config.ipaddress + ":" + config.port);
		this.controller = new mh.MyHomeClient(config.ipaddress, config.port, config.ownpassword, this);
		this.ready = false;
		this.devices = [];
		this.config.devices.forEach(function (accessory) {
			this.log.info("LegrandMyHome: adds accessory");
			accessory.parent = this;
			if (accessory.accessory == 'MHRelay') this.devices.push(new MHRelay(this.log,accessory))
			if (accessory.accessory == 'MHDimmer') this.devices.push(new MHDimmer(this.log,accessory))
			if (accessory.accessory == 'MHThermostat') this.devices.push(new MHThermostat(this.log,accessory))
		}.bind(this));
	}

	onMonitor(_frame) {

	}

	onRelay(_address,_onoff) {
		this.devices.forEach(function(accessory) {
			if (accessory.address == _address && accessory.lightBulbService !== undefined) {
				accessory.power = _onoff;
				accessory.bri = _onoff * 100;
				accessory.lightBulbService.getCharacteristic(Characteristic.On).getValue(null);
			}
		}.bind(this));
	}

	onDimmer(_address,_level) {
		this.devices.forEach(function(accessory) {
			if (accessory.address == _address && accessory.lightBulbService !== undefined) {
				accessory.power = (_level > 0) ? 1 : 0;
				accessory.bri = _level;
				accessory.lightBulbService.getCharacteristic(Characteristic.On).getValue(null);
			}
		}.bind(this));
	}

	onThermostat(_address,_measure,_level) {
		this.devices.forEach(function(accessory) {
			if (accessory.address == _address && accessory.TemperatureSensor !== undefined) {
				if (_measure == "AMBIENT") {
					accessory.ambient = _level;
					accessory.lightBulbService.getCharacteristic(Characteristic.getTemperature).getValue(null);
				}
			}
		}.bind(this));		
	}

	accessories(callback) {
		this.log.debug("LegrandMyHome (accessories readed)");
		callback(this.devices);
	}	
}

class MHRelay {
	constructor(log, config) {
		this.mh = config.parent.controller;
		this.name = config.name;
		this.address = config.address;
		this.displayName = config.name;
		this.UUID = UUIDGen.generate(config.address);
		this.log = log;
		
		this.power = false;
		this.bri = 100;
		this.sat = 0;
		this.hue = 0;
		this.log.info(sprintf("LegrandMyHome::MHRelay create object: %s", this.address));
	}

	getServices() {
		var service = new Service.AccessoryInformation();
		service.setCharacteristic(Characteristic.Name, this.name)
			.setCharacteristic(Characteristic.Manufacturer, "Legrand MyHome")
			.setCharacteristic(Characteristic.Model, "Relay")
			.setCharacteristic(Characteristic.SerialNumber, "Address " + this.address);

		this.lightBulbService = new Service.Lightbulb(this.name);

		this.lightBulbService.getCharacteristic(Characteristic.On)
			.on('set', (level, callback) => {
				this.log.debug(sprintf("setPower %s = %s",this.address, level));
				this.power = (level > 0);
				if (this.power && this.bri == 0) {
					this.bri = 100;
				}
				this.mh.relayCommand(this.address,this.power)
				callback(null);
			})
			.on('get', (callback) => {
				this.log.debug(sprintf("getPower %s = %s",this.address, this.power));
				callback(null, this.power);
			});
		return [service, this.lightBulbService];
	}
}

class MHDimmer {
	constructor(log, config) {
		this.mh = config.parent.controller;
		this.name = config.name;
		this.address = config.address;
		this.displayName = config.name;
		this.UUID = UUIDGen.generate(config.address);
		this.log = log;
		
		this.power = false;
		this.bri = 100;
		this.sat = 0;
		this.hue = 0;
		this.log.info(sprintf("LegrandMyHome::MHRelay create object: %s", this.address));
	}

	getServices() {
		var service = new Service.AccessoryInformation();
		service.setCharacteristic(Characteristic.Name, this.name)
			.setCharacteristic(Characteristic.Manufacturer, "Legrand MyHome")
			.setCharacteristic(Characteristic.Model, "Dimmer")
			.setCharacteristic(Characteristic.SerialNumber, "Address " + this.address);

		this.lightBulbService = new Service.Lightbulb(this.name);

		this.lightBulbService.getCharacteristic(Characteristic.On)
			.on('set', (level, callback) => {
				this.log.debug(sprintf("setPower %s = %s",this.address, level));
				this.power = (level > 0);
				if (this.power && this.bri == 0) {
					this.bri = 100;
				}
				this.mh.relayCommand(this.address,this.power)
				callback(null);
			})
			.on('get', (callback) => {
				this.log.debug(sprintf("getPower %s = %s",this.address, this.power));
				callback(null, this.power);
			});

		this.lightBulbService.getCharacteristic(Characteristic.Brightness)
			.on('set', (level, callback) => {
				this.log.debug(sprintf("setBrightness %s = %d",this.address, level));
				this.bri = parseInt(level);
				this.power = (this.bri > 0);
				this.mh.dimmerCommand(this.address,this.bri)
				callback(null);
			})
			.on('get', (callback) => {
				this.log(sprintf("getBrightness %s = %d",this.address, this.bri));
				callback(null, this.bri);
			});			
		return [service, this.lightBulbService];
	}
}


class MHThermostat {
	constructor(log, config) {
		this.mh = config.parent.controller;
		this.name = config.name;
		this.address = config.address;
		this.displayName = config.name;
		this.UUID = UUIDGen.generate(config.address);
		this.log = log;
		
		this.ambient = -1;
		this.setpoint = -1;
		this.mode = -1;
		this.log.info(sprintf("LegrandMyHome::MHThermostat create object: %s", this.address));
	}

	getServices() {
		var service = new Service.AccessoryInformation();
		service.setCharacteristic(Characteristic.Name, this.name)
			.setCharacteristic(Characteristic.Manufacturer, "Legrand MyHome")
			.setCharacteristic(Characteristic.Model, "Dimmer")
			.setCharacteristic(Characteristic.SerialNumber, "Address " + this.address);

		this.thermostatService = new Service.Thermostat(this.name);
		this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature)
			.on('get', (callback) => {
				this.log.debug(sprintf("getCurrentTemperature %s = %s",this.address, this.ambient));
				callback(null, this.ambient);
			});

		this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
			.on('get', (callback) => {
				callback(null, 10);
			});			

		this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState)
			.on('get', (callback) => {
				callback(null, 10);
			});			

		this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).setProps({minValue: 15, minStep:0.5, maxValue: 40})
			.on('set', (callback) => {
				
			}).on('get', (callback) => {
				this.log.debug(sprintf("getCurrentSetpoint %s = %s",this.address, 10));
				callback(null, 10);
			});


		return [service, this.thermostatService];
	}	
}