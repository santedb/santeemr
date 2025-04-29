/// <reference path="../../.ref/js/santedb.js"/>
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
angular.module('santedb').controller('EmrAdminVisitTypesController', [ "$scope", "$rootScope", "$timeout", function($scope, $rootScope, $timeout) {

    $scope.renderName = (r) => SanteDB.display.renderConcept(r);

    $scope.renderFlow = (r) =>  r.relationship.map(o=>SanteDB.display.renderConcept(o)).join(', ');
    var _relationships = {};

    $scope.loadFlow = async function(r) {
        if(!r.relationship) {
            
            if(_relationships[r.id]) {
                r.relationship = _relationships[r.id];
            }
            else {
                try {
                    var relationship = await SanteDB.resources.conceptRelationship.findAsync({ targetConcept: r.id, relationshipType: ConceptRelationshipTypeKeys.MemberOf, _viewModel: 'reverseRelationship' });
                    relationship.resource = relationship.resource || [];

                    _relationships[r.id] = relationship.resource.map(o=>o.sourceModel);
                    r.relationship = _relationships[r.id];
                }
                catch(e) {
                    console.warn(e);
                }
            }
        }
        return r;
    }

    $scope.removeVisitType = async function(r, idx)  {
        // Remove from the 
        if(confirm(SanteDB.locale.getString("ui.emr.admin.visitTypes.remove.confirm"))) {
            try {
                SanteDB.display.buttonWait(`#Conceptremove${idx}`, true);
                var patch = new Patch({
                    appliesTo: {
                        id: r, 
                        type: Concept.name
                    },
                    change: [
                        {
                            op: PatchOperationType.Remove,
                            path: "conceptSet",
                            value: '42764da0-17be-11eb-adc1-0242ac120002'
                        }
                    ]
                });
                await SanteDB.resources.concept.patchAsync(r, null, patch, true);
                toastr.success(SanteDB.locale.getString("ui.emr.admin.visitTypes.remove.success"));

                $("#visitTypeTable").attr('newQueryId', true);
                $("#visitTypeTable table").DataTable().draw();
            }
            catch(e){
                $rootScope.errorHandler(e);
            }
            finally {
                SanteDB.display.buttonWait(`#Conceptremove${idx}`, false);

            }
        }
    }
}]);