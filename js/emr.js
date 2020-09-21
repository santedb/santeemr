/**
 * @method
 * @summary Renders patient information for tables
 * @param {Patient} patient The patient to render a summary for
 */
function renderPatientSummary(patient) {

    var retVal = "";
    if (patient.name) {
        var key = Object.keys(patient.name)[0];
        retVal += `<strong>${SanteDB.display.renderEntityName(patient.name[key])}</strong>`;
    }
    if (patient.identifier) {
        retVal += "<span class='badge badge-secondary'>";
        var preferred = SanteDB.configuration.getAppSetting("aa.preferred");
        if (patient.identifier[preferred])
            retVal += `<i class="fas fa-id-card"></i> ${SanteDB.display.renderIdentifier(patient.identifier, preferred)}`;
        else {
            var key = Object.keys(patient.identifier)[0];
            retVal += `<i class="far fa-id-card"></i> ${SanteDB.display.renderIdentifier(patient.identifier, key)}`;
        }
        retVal += `</span><br/>`;
    }

    
    if(patient.address) {
        var key = Object.keys(patient.address)[0];
        retVal += `<em><i class="fas fa-city"></i> ${SanteDB.display.renderEntityAddress(patient.address[key])}</em><br/>`;
    }

    retVal += `<i class='fas fa-birthday-cake'></i> ${SanteDB.display.renderDate(patient.dateOfBirth, patient.dateOfBirthPrecision)} `;

    // Deceased?
    if (retVal.deceasedDate)
        retVal += `<span class='badge badge-dark'>${SanteDB.locale.getString("ui.model.patient.deceased")}</span>`;

    // Gender
    switch (patient.genderConceptModel.mnemonic) {
        case 'Male':
            retVal += `<i class='fas fa-male' title="${SanteDB.display.renderConcept(patient.genderConceptModel)}"></i> ${SanteDB.display.renderConcept(patient.genderConceptModel)}`;
            break;
        case 'Female':
            retVal += `<i class='fas fa-female' title="${SanteDB.display.renderConcept(patient.genderConceptModel)}"></i> ${SanteDB.display.renderConcept(patient.genderConceptModel)}`;
            break;
        default:
            retVal += `<i class='fas fa-restroom' title="${SanteDB.display.renderConcept(patient.genderConceptModel)}"></i> ${SanteDB.display.renderConcept(patient.genderConceptModel)}`;
            break;
    }
    

    return retVal;
}

// Register view handlers
$(document).ready(function() {
    SanteDB.display.registerResourceDisplayState("Patient", null, function(resource, $state) {
        $state.transitionTo("santedb-emr.patient.view", { "id" : resource.id });
    });
});


// JWS Pattern
var jwsDataPattern = /^(.*?)\.(.*?)\.(.*?)$/;

/**
 * @summary Performs a search
 * @param {string} qrCodeData Existing qrCode data
 * @param {boolean} noValidate True if no validation should be performed
 * @param {boolean} upstream Search upstream service
 * @returns {IdentifiedData} Either a bundle or the discrete resource (what the barcode points at)
 */
async function searchByBarcode(qrCodeData, noValidate, upstream) {
    try {
        if (!qrCodeData)
            qrCodeData = await SanteDB.application.scanBarcodeAsync();

        // QR Code is a signed code
        if (jwsDataPattern.test(qrCodeData)) {
            var result = await SanteDB.application.ptrSearchAsync(qrCodeData, !noValidate, upstream || false);
            result.$novalidate = noValidate;
            result.$upstream = upstream;
            return result;
        }
        else {
            var result = await SanteDB.resources.entity.findAsync({ "identifier.value" : qrCodeData});
            result.$search = qrCodeData;
            return result;
        }
    }
    catch (e) {
        // Error was with validating the code
        if (e.rules && e.rules.length > 0 && e.rules.filter(o => o.id == "jws.verification" || o.id == "jws.app" || o.id == "jws.key").length == e.rules.length) {
            return await searchByBarcode(qrCodeData, true, upstream);
        }
        else if(!upstream && (e.$type == "KeyNotFoundException" || e.cause && e.cause.$type == "KeyNotFoundException")  && confirm(SanteDB.locale.getString("ui.emr.search.online"))) {
            // Ask the user if they want to search upstream, only if they are allowed
            var session = await SanteDB.authentication.getSessionInfoAsync();

            if(session.method == "LOCAL") // Local session so elevate to use the principal elevator
            {
                var elevator = new ApplicationPrincipalElevator();
                await elevator.elevate(session);
                SanteDB.authentication.setElevator(elevator);
            }
            return await searchByBarcode(qrCodeData, true, true);
        }
        throw e;
    }
    finally {
        SanteDB.authentication.setElevator(null);
    }
}

// Correct information such as addresses and other information on the patient profile
async function correctEntityInformation(entity) {
    // Update the address - Correcting any linked addresses to the strong addresses
    // TODO: 
    if (entity.address) {
        var addressList = [];
        var promises = Object.keys(entity.address).map(async function (k) {
            try {
                var addr = entity.address[k];
                if (!Array.isArray(addr))
                    addr = [addr];

                var intlPromises = addr.map(async function (addrItem) {
                    addrItem.use = addrItem.useModel.id;
                    addrItem.component = addrItem.component || {};
                    delete (addrItem.useModel);
                    addressList.push(addrItem);
                });
                await Promise.all(intlPromises);
            }
            catch (e) {
            }
        });
        await Promise.all(promises);
        entity.address = { "$other": addressList };
    }
    if (entity.name) {
        var nameList = [];
        Object.keys(entity.name).forEach(function (k) {

            var name = entity.name[k];
            if (!Array.isArray(name))
                name = [name];

            name.forEach(function (nameItem) {
                nameItem.use = nameItem.useModel.id;
                delete (nameItem.useModel);
                nameList.push(nameItem);
            })

        });
        entity.name = { "$other": nameList };
    }

}
