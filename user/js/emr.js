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

/**
 * @class
 * @static
 * @constructor
 * @summary SanteEMR Binding Class
 * @description This is a wrapper class that encapsulates the functionality of SanteEMR
 */
function SanteEMRWrapper() {


    /**
     * @method
     * @memberof SanteEMRWrapper
     * @param {string} patientId The patient identifier to show the checkin modal for
     */
    this.showCheckin = function(patientId) {
        var checkinModal = angular.element("#checkinModal");
        if(checkinModal == null) {
            console.warn("Have not included the checkin modal");
        }

        checkinModal.scope().patientId = patientId;
        $("#checkinModal").modal('show');
    }

    /**
     * @summary Determines whether the patient has an open encounter or not
     * @param {Patient} patient The patient which is supposed to have the open encounter
     * @returns The updated patient with a populated tag if the encounter is open
     */
    this.patientHasOpenEncounter = async function (patient) {
        if (patient.id) {
            try {
                var encounters = await SanteDB.resources.patientEncounter.findAsync({ moodConcept: ActMoodKeys.Eventoccurrence, statusConcept: StatusKeys.Active, "participation[RecordTarget].player": patient.id, _count: 0, _includeTotal: true });
                if (encounters.totalResults > 0) {
                    patient.tag = patient.tag || {};
                    patient.tag.$hasEncounter = true;
                }
            }
            catch (e) { }
        }
        return patient;
    }

    
    /**
     * @summary Resolves the template icon for the specified act/entity template
     * @param {string} templateId The template mnemonic to resolve the icon for
     * @returns The resolved icon 
     */
    this.resolveTemplateIcon = function(templateId) {
        SanteDB.application.getTemplateDefinitionsAsync(); // HACK: Force Fetching
        var template = SanteDB.application.getTemplateMetadata(templateId);
        if(template) {
            return template.icon;
        }
        else {
            return "fa-notes-medical";
        }
    }

    /**
     * @summary Resolve the summary template (one line summary) for the template
     * @param {string} templateId The template mnemonic to resolve the summary for
     * @returns {String} The location of the summary template
     */
    this.resolveSummaryTemplate = function(templateId) {
        SanteDB.application.getTemplateDefinitionsAsync(); // HACK: Force Fetching
        var templateValue = SanteDB.application.resolveTemplateSummary(templateId);
        if(templateValue == null) {
            return  "/org.santedb.uicore/partials/act/noTemplate.html"
        }
        return templateValue;
    }

    /**
     * @summary Starts a visit given the input parameters provided
     * @param {string} templateId The visit template (encounter template) which is to be started, this dictates the input form and the structure of the visit
     * @param {string} carePathway The care pathway in which this visit fits (used for generating the CDSS actions)
     * @param {string} recordTargetId The identification of the record target to which the visit is intended 
     * @param {ActRelationship} fulfills An array of {@link:ActRelationship} objects which represent the encounter in the care plan that this visit fulfills
     * @param {ActRelationship} fulfillmentComponents An array of {@link:ActRelationship} objects which reprensets the proposals from the stored care plan which this visit is fulfilling
     * @returns {PatientEncounter} The constructed and saved {@link:PatientEncounter}
     */
    this.startVisitAsync = async function(templateId, carePathway, recordTargetId, fulfills, fulfillmentComponents) {
        try {

            var submission = new Bundle({ resource: [] });

            // Template
            var template = await SanteDB.application.getTemplateContentAsync(templateId, {
                recordTargetId: recordTargetId,
                facilityId: await SanteDB.authentication.getCurrentFacilityId(),
                userEntityId: await SanteDB.authentication.getCurrentUserEntityId()
            });

            var encounter = new PatientEncounter(template);
            encounter.id = encounter.id || SanteDB.application.newGuid();
            encounter.relationship = encounter.relationship || {};
            encounter.relationship.HasComponent = encounter.relationship.HasComponent || [];
            encounter.relationship.Fulfills = fulfills;
            // Ensure the appropriate keys are set
            encounter.startTime = encounter.actTime = new Date();
            encounter.statusConcept = StatusKeys.Active;

            // Compute the actions to be performed
            var actions = await SanteDB.resources.patient.invokeOperationAsync(recordTargetId, "generate-careplan", {
                pathway: carePathway,
                encounter: template.templateModel.mnemonic,
                period: moment().format("YYYY-MM-DD")
            }, undefined, "min");

            actions.relationship.HasComponent.forEach(comp => {
                var ar = new ActRelationship({
                    relationshipType: comp.relationshipType,
                    target: comp.target || comp.targetModel.id || SanteDB.application.newGuid(),
                    targetModel: comp.targetModel,
                    source: encounter.id
                });
                encounter.relationship.HasComponent.push(ar);
                comp.targetModel.id = comp.targetModel.id || ar.target;

                // Fulfillment for the target model
                if (comp.targetModel && comp.targetModel.protocol) {
                    var fulfillment = fulfillmentComponents.find(o => {
                        var targetAct = o.targetModel;
                        return targetAct.protocol.find(p => comp.targetModel.protocol.find(p2 => p2.protocol == p.protocol && p2.sequence == p.sequence))
                    });
                    if (fulfillment) {
                        comp.targetModel.relationship = comp.targetModel.relationship || {};
                        comp.targetModel.relationship.Fulfills = comp.targetModel.relationship.Fulfills || [];
                        comp.targetModel.relationship.Fulfills.push(new ActRelationship({
                            target: fulfillment.target
                        }));
                    }
                }
            });
            
            encounter = await prepareActForSubmission(encounter);
            submission = bundleRelatedObjects(encounter);

            // Now we want to submit
            var submittedBundle = await SanteDB.resources.bundle.insertAsync(submission);
            return submittedBundle.resource.find(o=>o.$type == "PatientEncounter");
        }
        catch(e) {
            throw new Exception("EmrException", e.message, null, e);
        }
    }
    
}

/**
 * @type {SanteEMRWrapper}
 * @global
 */
var SanteEMR = new SanteEMRWrapper();

// Helper functions
Patient.prototype.age = function(measure) {
    return moment().diff(this.dateOfBirth, measure || 'years', false);
}

Patient.prototype.hasCondition = function(conditionTypeConcept)
{

}