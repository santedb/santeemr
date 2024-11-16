/// <reference path="../.ref/js/santedb.js"/>

/**
 * @method
 * @summary Ignore a candidate link
 * @param {string} recordA The holder record to add ignore relationship to
 * @param {string} recordB The target record to add ignore relationship to
 */
async function ignoreCandidateAsync(recordA, recordB) {
    // Confirm the action
    if(!confirm(SanteDB.locale.getString("ui.emr.matches.ignore.confirm")))
        return;

    // Send the MDM-ignore post
    try {
        // We DELETE the candidate (ignore it)
        var ignoreResult = await SanteDB.resources.patient.removeAssociatedAsync(recordA, "match-candidate", recordB, true);
        toastr.success(SanteDB.locale.getString("ui.emr.matches.ignore.success"));
        return ignoreResult;
    }
    catch(e) {
        toastr.error(SanteDB.locale.getString("ui.emr.matches.ignore.error"));
        throw e;
    }
}


/**
 * @method
 * @summary Remove an ignore a candidate link
 * @param {string} recordA The holder from which the ignore relationship is to be removed
 * @param {string} recordB The target which the ignore should be removed
 */
 async function unIgnoreCandidateAsync(recordA, recordB) {
    // Confirm the action
    if(!confirm(SanteDB.locale.getString("ui.emr.matches.unignore.confirm")))
        return;

    // Send the MDM-ignore post
    try {
        // We DELETE the candidate (ignore it)
        var ignoreResult = await SanteDB.resources.patient.removeAssociatedAsync(recordA, "match-ignore", recordB, true);
        toastr.success(SanteDB.locale.getString("ui.emr.matches.unignore.success"));
        return ignoreResult;
    }
    catch(e) {
        toastr.error(SanteDB.locale.getString("ui.emr.matches.unignore.error"));
        throw e;
    }
}



// Set the view handlers
if(!SanteDB.application.getResourceViewer("Patient")) {
    SanteDB.application.addResourceViewer("Patient", function(state, parms) { state.transitionTo("santedb-admin.emr.patients.view", parms); return true; });
}
if(!SanteDB.application.getResourceViewer("Match")) {
    SanteDB.application.addResourceViewer("Match", function(state, parms) { state.transitionTo("santedb-admin.emr.matches.view", parms); return true; });
}