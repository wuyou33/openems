import { Component, Input, Output, OnChanges, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { FormControl, FormGroup, FormArray, AbstractControl, FormBuilder } from '@angular/forms';
import * as moment from 'moment';

import { DefaultMessages } from '../../../shared/service/defaultmessages';
import { Utils } from '../../../shared/service/utils';
import { ConfigImpl } from '../../../shared/device/config';
import { Device } from '../../../shared/device/device';
import { DefaultTypes } from '../../../shared/service/defaulttypes';
import { Role, ROLES } from '../../../shared/type/role';

@Component({
  selector: 'channel',
  templateUrl: './channel.component.html'
})
export class ChannelComponent implements OnChanges, OnDestroy {

  public form: FormGroup = null;
  public meta = null;
  public type: string;
  public specialType: "simple" | "ignore" | "boolean" | "selectNature" | "deviceNature" = "simple";

  private isJson = false;
  private stopOnDestroy: Subject<void> = new Subject<void>();

  @Input() public thingId: string = null;
  @Input() public channelId: string = null;
  @Input() public config: ConfigImpl = null;
  @Input() public role: Role = ROLES.guest; // TODO in device
  @Input() public device: Device = null;

  @Output() public message: Subject<DefaultTypes.ConfigUpdate> = new Subject<DefaultTypes.ConfigUpdate>();

  constructor(
    public utils: Utils,
    private formBuilder: FormBuilder) { }

  ngOnChanges() {
    if (this.config != null && this.thingId != null && this.thingId in this.config.things && this.channelId != null) {
      let thingConfig = this.config.things[this.thingId];
      let clazz = thingConfig.class;
      if (clazz instanceof Array) {
        return;
      }
      let thingMeta = this.config.meta[clazz];
      let channelMeta = thingMeta.channels[this.channelId];
      this.meta = channelMeta;

      // get value or default value
      let value = thingConfig[this.channelId];
      if (value == null) {
        value = channelMeta.defaultValue;
      }

      // set form input type and specialType-flag
      let metaType = this.meta.type;
      switch (metaType) {
        case 'Boolean':
          this.specialType = 'boolean';
          break;

        case 'Integer':
        case 'Long':
          this.type = 'number';
          break;

        case 'String':
          this.type = 'string';
          break;

        case 'JsonArray':
        case 'JsonObject':
          this.specialType = 'simple';
          this.isJson = true;
          value = JSON.stringify(value);
          break;

        default:
          if (metaType in this.config.meta) {
            // this is a DeviceNature
            let otherThingMeta = this.config.meta[metaType];
            if (value == null || value == '') {
              // TODO create thing
              this.specialType = 'ignore';
            } else {
              this.specialType = 'deviceNature';
            }
          } else if (this.config.meta instanceof Array) {
            // this is a DeviceNature id
            this.specialType = 'selectNature';
            this.type = this.meta.type + 'Nature';
          } else {
            console.warn("Unknown type: " + this.meta.type, this.meta);
            this.type = 'string';
          }
      }

      // build form
      this.form = this.buildFormGroup({ channelConfig: value });

      // subscribe to form changes and build websocket message
      this.form.valueChanges
        .takeUntil(this.stopOnDestroy)
        .map(data => data["channelConfig"])
        .subscribe(value => {
          if (this.isJson) {
            value = JSON.parse(value);
          }
          this.message.next(DefaultMessages.configUpdate(this.thingId, this.channelId, value));
        });
    }
  }

  ngOnDestroy() {
    this.stopOnDestroy.next();
    this.stopOnDestroy.complete();
  }

  public addToArray() {
    let array = <FormArray>this.form.controls["channelConfig"];
    array.push(this.formBuilder.control(""));
  }

  public removeFromArray(index: number) {
    let array = <FormArray>this.form.controls["channelConfig"];
    array.removeAt(index);
  }

  protected buildForm(item: any, ignoreKeys?: string | string[]): FormControl | FormGroup | FormArray {
    if (typeof item === "function") {
      // ignore
    } else if (item instanceof Array) {
      return this.buildFormArray(item, ignoreKeys);
    } else if (item instanceof Object) {
      return this.buildFormGroup(item, ignoreKeys);
    } else {
      return this.buildFormControl(item, ignoreKeys);
    }
  }

  private buildFormGroup(object: any, ignoreKeys?: string | string[]): FormGroup {
    let group: { [key: string]: any } = {};
    for (let key in object) {
      if ((typeof ignoreKeys === "string" && key == ignoreKeys) || (typeof ignoreKeys === "object") && ignoreKeys.some(ignoreKey => ignoreKey === key)) {
        // ignore
      } else {
        var form = this.buildForm(object[key], ignoreKeys);
        if (form) {
          group[key] = form;
        }
      }
    }
    return this.formBuilder.group(group);
  }

  private buildFormControl(item: Object, ignoreKeys?: string | string[]): FormControl {
    return this.formBuilder.control(item);
  }

  private buildFormArray(array: any[], ignoreKeys?: string | string[]): FormArray {
    var builder: any[] = [];
    for (let item of array) {
      var control = this.buildForm(item, ignoreKeys);
      if (control) {
        builder.push(control);
      }
    }
    return this.formBuilder.array(builder);
  }

}