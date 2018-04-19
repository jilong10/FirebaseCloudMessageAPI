'use-strict'

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

exports.sendNotification = functions.database.ref("/notifications/{user_id}/{notification_id}")
	.onWrite(event => {
		const user_id = event.params.user_id;
		const notification_id = event.params.notification_id;

		let valueObject = event.data.val();

		// Create a notification
		const payload = {
			notification: {
				title: "Alert",
				body: valueObject.toString()
			}
		};
		
		console.log("User ID: " + user_id + " has sent " + "Notification ID: " + notification_id);
		console.log("Message: " + valueObject.toString());

		return admin.messaging().sendToDevice(notification_id, payload);			
	});

exports.sendNotificationDueLocation = functions.database.ref("/currentLocation/{location_key}")
	.onUpdate(event => {
		const location_key = event.params.location_key;
		checkDistanceForSenior(location_key);				
	});

function distance(lat1, lon1, lat2, lon2, unit) {
    var radlat1 = Math.PI * lat1/180
    var radlat2 = Math.PI * lat2/180
    var radlon1 = Math.PI * lon1/180
    var radlon2 = Math.PI * lon2/180
    var theta = lon1-lon2
    var radtheta = Math.PI * theta/180
    var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    dist = Math.acos(dist)
    dist = dist * 180/Math.PI
    dist = dist * 60 * 1.1515
    if (unit==="K") { dist = dist * 1.609344 }
    if (unit==="N") { dist = dist * 0.8684 }
    return dist
}

function checkDistanceForSenior(location_key) {
	// Create a notification
	const payload = {
		notification: {
			title: "Senior Alert",
			body: "Senior out of range"
		}
	};		

	const payloadSenior = {
		notification: {
			title: "Senior Alert",
			body: "You are out of range"
		}
	};	

	admin.database().ref('/currentLocation/' + location_key).once('value', snapshot => {
		const udid = snapshot.child('udid').val();
		const latitude = snapshot.child('latitude').val();
		const longitude = snapshot.child('longitude').val();
		let hasSent = false;
		
		admin.database().ref('/Boundary').once('value', boundarySnapshot => {
			boundarySnapshot.forEach(boundaryChildSnapshot => {
				if (boundaryChildSnapshot.child('childUid').val() === udid) {
					const parentUid = boundaryChildSnapshot.child('parentUid').val();
					const radius  = boundaryChildSnapshot.child('radius').val();
					const boundaryLat = boundaryChildSnapshot.child('latitude').val();
					const boundaryLong = boundaryChildSnapshot.child('longitude').val();
					const dist = distance(latitude, longitude, boundaryLat, boundaryLong, "K") * 1000;					

					console.log(`Udid: ${udid}, lat: ${latitude}, long: ${longitude}, parentUid: ${parentUid}, radius: ${radius}, boundary lat: ${boundaryLat}, boundary long: ${boundaryLong}, distance: ${dist}`);

					if (dist > radius) {
						admin.database().ref('/users/' + parentUid + '/token').once('value', userSnapshot => {							
							if (!hasSent) {
								console.log(`Caregiver Token: ${userSnapshot.val()}`);
								admin.messaging().sendToDevice(userSnapshot.val(), payload);
								hasSent = true;								
							}
						});												
					}
				}
			});
		});
	});
}