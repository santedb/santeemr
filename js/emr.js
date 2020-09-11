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