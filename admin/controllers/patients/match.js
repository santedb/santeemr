/// <reference path="../../.ref/js/santedb.js"/>
angular.module('santedb').controller('EmrMatchViewController', ["$scope", "$rootScope", "$state", "$templateCache", "$stateParams", "$timeout", function ($scope, $rootScope, $state, $templateCache, $stateParams, $timeout) {


    // Load related entity
    async function populateTarget(rel, reverse) {
        try {
            console.info(rel);
            // REL > OTHER
            if(!reverse) {
                if(!rel.targetModel || rel.targetModel.$type != 'Patient') {
                    rel.refModel = await SanteDB.resources.ensureTypeAsync(rel.targetModel || await SanteDB.resources.patient.getAsync(rel.target), 'Patient');
                } 
                else {
                    rel.refModel = rel.targetModel;
                }
            }
            // REL < OTHER
            else {
                if(!rel.holderModel || rel.holderModel.$type != 'Patient') {                
                    rel.refModel = await SanteDB.resources.ensureTypeAsync(rel.holderModel || await SanteDB.resources.patient.getAsync(rel.holder), 'Patient');
                }
                else {
                    rel.refModel = rel.holderModel; 
                }
            }
            return rel;
        }
        catch(e) {
            // No need for errors here
        }
        finally {
            // no finally clauses needed
        }
    }

    // Load other candidates
    async function loadOtherCandidiates(patient){
        try {
            var retVal = [];
            patient.relationship = patient.relationship || [];
            if(patient.relationship && patient.relationship['Duplicate']) {
                await Promise.all( patient.relationship['Duplicate'].map(async (o)=>retVal.push(await populateTarget(o))));
            }
            return retVal;
        }
        catch(e) {

        }
    }

    // Function to iniitalize the view
    async function initializeView() {
        try {
            var recordA = null, recordB = null, candidate = null;
            if($stateParams.id) {
                candidate = await SanteDB.resources.entityRelationship.getAsync($stateParams.id, "emr.duplicateRelationship");
                recordA = await SanteDB.resources.ensureTypeAsync(candidate.holderModel || await SanteDB.resources.patient.getAsync(candidate.holder, "fastview"), "Patient");
                recordB = await SanteDB.resources.ensureTypeAsync(candidate.targetModel || await SanteDB.resources.patient.getAsync(candidate.target, "fastview"), "Patient");
            }
            else if($stateParams.sourceId && $stateParams.targetId) {
                candidate = {};
                recordA = await SanteDB.resources.patient.getAsync($stateParams.sourceId, "fastview");
                recordB = await SanteDB.resources.patient.getAsync($stateParams.targetId, "fastview");
            }
            else {
                throw new Exception("ArgumentException", "ui.emr.error.match.missingArguments");
            }
            // Load other matches for the screen
            if(candidate.id) {
                recordA.relationship = recordA.relationship || [];
                recordB.relationship = recordB.relationship || [];
                recordA.relationship['Duplicate'] = await loadOtherCandidiates(recordA, candidate.id);
                recordB.relationship['Duplicate'] = await loadOtherCandidiates(recordB, candidate.id);
            }
            
            // Get the match report for the specified objects A<>B
            var matchReport = await SanteDB.resources.patient.getAssociatedAsync(recordA.id, "match-candidate", recordB.id, { _configuration : $stateParams.configurationId }, true);
            matchReport.recordA = recordA;
            matchReport.recordB = recordB;
            matchReport.candidate = candidate;

            // Set the best match
            matchReport.results = matchReport.results.sort((a,b) => b.strength - a.strength);
            matchReport._isConfigurationIssue = candidate.relationshipType == '2bbf068b-9121-4081-bf3c-ab62c01362ee' && matchReport.results[0].classification == 2;

            // Apply 
            $timeout(_=> 
            {
                $scope.matchReport = matchReport;
            });
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

     /**
     * Submit an "ignore" request for the specified relationship
     */
      $scope.ignore = async function() {
        try {

            SanteDB.display.buttonWait(`#btnIgnore`, true);
            await ignoreCandidateAsync($scope.matchReport.recordA.id, $scope.matchReport.recordB.id);
            // Go back 
            $state.transitionTo('santedb-admin.emr.patients.dashboard');
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait(`#btnIgnore`, false);
        }
    }

    /**
     * Submit a RESOLVE 
     */
    $scope.resolve = async function() {
        try {

            SanteDB.display.buttonWait(`#btnResolve`, true);
            await attachCandidateAsync($scope.matchReport.recordA.id, $scope.matchReport.recordB.id);
            // Go back 
            $state.transitionTo('santedb-admin.emr.patients.dashboard');
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait(`#btnResolve`, false);
        }
    }


    initializeView();
}]);