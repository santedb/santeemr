/**
 * @method
 * @summary Renders patient information for tables
 * @param {Patient} patient The patient to render a summary for
 */
function renderPatientSummary(patient) {

    var retVal = `<a style="width:100%" ui-sref='santedb-emr.patient.view({ id: "${patient.id}" })'>`;
    if (patient.name) {
        var key = Object.keys(patient.name)[0];
        retVal += `<span class="primary-result-link">${SanteDB.display.renderEntityName(patient.name[key])}</span>`;
    }
    if (patient.identifier) {
        retVal += "<div class='d-none d-sm-inline badge badge-secondary'>";
        var preferred = SanteDB.configuration.getAppSetting("aa.preferred");
        if (patient.identifier[preferred])
            retVal += `<i class="fas fa-id-card"></i> ${SanteDB.display.renderIdentifier(patient.identifier, preferred)}`;
        else {
            var key = Object.keys(patient.identifier)[0];
            retVal += `<i class="far fa-id-card"></i> ${SanteDB.display.renderIdentifier(patient.identifier, key)}`;
        }
        retVal += `</div><br/>`;
    }

    
    if(patient.address) {
        var key = Object.keys(patient.address)[0];
        retVal += `<em><i class="fas fa-city"></i> ${SanteDB.display.renderEntityAddress(patient.address[key])}</em><br/>`;
    }

    retVal += `<i class='fas fa-birthday-cake'></i> ${SanteDB.display.renderDate(patient.dateOfBirth, patient.dateOfBirthPrecision)} `;

    // Deceased?
    if (patient.deceasedDate)
        retVal += `<span class='badge badge-dark'>${SanteDB.locale.getString("ui.model.patient.deceasedIndicator")}</span>`;

    // Gender
    if(patient.genderConceptModel)
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
    
    if(patient.tag && patient.tag["$upstream"] == "true")
    {
        retVal += `<span class='badge badge-info'><i class='fas fa-cloud'></i> ${SanteDB.locale.getString("ui.emr.search.onlineResult")} </span>`;
    }

    retVal += "</a>";
    return retVal;
}


// Convert an age to a date
function ageToDate(age, onDate) {

    return moment(onDate).subtract({years: age}).startOf('day').toDate();
}

/// Convert a date to an age
function dateToAge(date, onDate) {
    return moment(onDate).diff(date, 'years', false);

}


const ADT_REGISTRATION_TYPES = {
    BIRTH: 'f562e322-17ca-11eb-adc1-0242ac120002',
    DEATH: 'f562e458-17ca-11eb-adc1-0242ac120002',
    ADMIT: 'f562e624-17ca-11eb-adc1-0242ac120002'
}

const TEMPLATE_IDS = {
    SupplementAdministration: 'feac9b2d-e560-4b75-ac77-921bf0eceee8',
    BirthRegistration: 'c521e96f-3e5e-4347-8279-5228b4b68be6',
    DeathRegistration: '627b5b71-ba67-484b-811c-9ef00ec4d5f0',
    NewbornInformation: 'b0ca8509-6c0d-403a-b381-5485fdce5794',
    CauseOfDeath: '3fc9cce1-b9bb-4a9d-b054-2d19fa34da72',
    Patient: '81bc8c96-2f02-4c3f-9e2a-50fba42984a7',
    BirthLocation: 'b7548aa1-97a6-4c3a-b735-2d1dbf2898f8',
    BirthDeliveryMethod: '5d31af1e-8bd5-4e22-a1cb-299a7a91ccbb',
    BirthDeliveryOutcome: '6f48110f-c5e7-47a1-ae02-00ef94c1edcc',
    BirthWeight: '20691188-f1ca-4d06-90a4-8f857c293853',
    BodyHeight: 'e052a85e-b7fb-4808-aa5c-14147abd5fe8',
    PregnancyHistory: 'ea4e5cfb-fb49-434f-8b5e-c8f027f18775',
    ClinicalDeath: '740bd62b-54bf-4bba-8546-954cdb5bb63a',
    VerificationStatus: '637be9d0-1d17-46b6-abce-35f90fb0eb9a',
    ImmunizationAdministration: '50ac9b2d-e560-4b75-ac77-921bf0eceee8'
}