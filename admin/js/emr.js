/// <reference path="../.ref/js/santedb.js"/>
/*
 * Copyright (C) 2021 - 2025, SanteSuite Inc. and the SanteSuite Contributors (See NOTICE.md for full copyright notices)
 * Portions Copyright (C) 2019 - 2021, Fyfe Software Inc. and the SanteSuite Contributors
 * Portions Copyright (C) 2015-2018 Mohawk College of Applied Arts and Technology
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you
 * may not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 *
 */

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