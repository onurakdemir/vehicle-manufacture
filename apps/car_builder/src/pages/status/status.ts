/*
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { Component, ChangeDetectorRef } from '@angular/core';
import { NavController, NavParams } from 'ionic-angular';
import { Geolocation } from '@ionic-native/geolocation';
import { ConfigProvider } from '../../providers/config/config';
import { Http, RequestOptions, Headers } from '@angular/http';

/**
 * Generated class for the StatusPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */
@Component({
  selector: 'page-status',
  templateUrl: 'status.html',
})
export class StatusPage {
  car: Object;
  order: any;
  ready: Boolean = false;
  stage: Array<String>;
  relativeDate: any;
  config: any;
  baseStatus: string = 'Insure me';
  insureStatus: string = this.baseStatus;

  constructor(public navCtrl: NavController, public navParams: NavParams, private geolocation: Geolocation, private configProvider: ConfigProvider, private ref: ChangeDetectorRef, private http: Http) {
    this.ready = false;
    this.car = navParams.get('car');

    this.order = navParams.get('order');

    this.stage = [this.order.placed + ''];

    this.relativeDate = function(input: number, start: number) {
      console.log(start, input);

      if (input) {
        var diff = input - start;
        diff = diff / 1000
        diff = Math.round(diff);

        var result = '+' + diff +  ' secs'

        return result;
      }
    };
    

    this.configProvider.ready.subscribe((ready) => {
      if (ready) {
        this.config = this.configProvider.getConfig();
        
        this.setupListener(this.config.restServer+'/org.acme.vehicle_network.vehicles/orders/events/updated', this.handleOrderUpdate.bind(this));

        this.ready = true;
      }
    });
  }

  setupListener (url: string, callback: (data: any, listener: any) => void) {
    const listener = new (window as any).EventSource(url);

    listener.onopen = (evt) => {
      console.log('OPEN', evt);
    }

    listener.onerror = (evt) => {
        console.log('ERROR', evt);
    }

    listener.onclose = (evt) => {
      this.setupListener(url, callback);
    }
    
    listener.onmessage = (evt) => {
      const update = JSON.parse(evt.data);

      callback(update, listener);

      this.ref.detectChanges();
    }
  }

  handleOrderUpdate(update: any, listener: any) {
    if (update.id === this.order.id) {
      let i = update.orderStatus;
      this.stage[i] = this.relativeDate(update.timestamp, this.stage[0]);
      if (update.orderStatus === 2) {
        this.order.vin = update.vin;
      }

      if (update.orderStatus === 4) {
        listener.close()
      }
    }
  }

  handlePolicyCreated(policy: any, listener: any) {
    if (policy.holderId === this.order.ordererId && policy.vin === this.order.vin) {
      this.insureStatus = `Policy created (${policy.id})`;

      listener.close();
    }
  }

  async insure() {
    this.insureStatus = 'Processing...';
    
    this.stage[5] = "Insured";

    const success = async (position) => {
    
      console.log('insure me please');

      const date = new Date();
      date.setMonth(date.getMonth() + 12);

      const data = JSON.stringify({
        vin: this.order.vin,
        holderId: this.order.ordererId,
        policyType: 2,
        endDate: date.getTime()
      });

      const headers = new Headers();
      headers.append('Authorization', 'Basic ' + btoa('system:systempw'));
      headers.append('Content-Type', 'application/json');
      const reqOpts = new RequestOptions({});
      reqOpts.headers = headers;

      try {
        await this.http.post(this.config.insurer + '/org.acme.vehicle_network.vehicles/policies/requests', data, reqOpts).toPromise();

        this.insureStatus = 'Request sent \u2713';

        this.setupListener(this.config.restServer + '/org.acme.vehicle_network.vehicles/policies/events/created', this.handlePolicyCreated.bind(this));
      } catch (err) {
        console.log(err);
      }
    }

    const error = (error) => {
      console.log(error)
      this.stage.splice(5,1)
      this.insureStatus = this.baseStatus;

      switch(error.code) {
        case error.PERMISSION_DENIED:
          console.log("Location information is unavailable, your browser may be blocking them. Using a default location")
          this.stage[5] = "Insured";
          success({"coords": {"latitude": null, "longitude": null}})
          break;
        case error.POSITION_UNAVAILABLE:
          console.log("Location information is unavailable, your browser may be blocking them. Using a default location")
          this.stage[5] = "Insured";
          success({"coords": {"latitude": null, "longitude": null}})
          break;
        case error.TIMEOUT:
          alert("The request to get user location timed out.")
          break;
        case error.UNKNOWN_ERROR:
          alert("An unknown error occurred.")
          break;
        default: 
          console.log("Location information is unknown. Using default")
          this.stage[5] = "Insured";
          success({"coords": {"latitude": null, "longitude": null}})
          break;
      }
    }

    try {
      await success(await this.geolocation.getCurrentPosition());
    } catch (err) {
      error(err);
    }
  }
}
