/// <reference path="../../../.ref/js/santedb.js" />
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

angular.module('santedb').controller('EmrPatientNextOfKinController', ["$scope", "$rootScope", "$state", "$templateCache", "$interval", function ($scope, $rootScope, $timeout, $state, $templateCache, $interval) {
    $scope.revertRemoveRelative = revertRemoveRelative;
    $scope.removeRelative = removeRelative;
    $scope.addNewRelative = addNewRelative;
    $scope.excludeRelationshipTypes = [];
    $scope.getTabPaneId = getTabPaneId;
    $scope.tabHasError = tabHasError;
    $scope.copyFields = copyFields;
    $scope.ageToDate = ageToDate;
    $scope.dateToAge = dateToAge;

    // Copy fields
    function copyFields(relationshipTarget) {
        relationshipTarget.address = angular.copy($scope.scopedObject.address);
    }

    // Determine if tab has error
    function tabHasError(tabInputPrefix) {
        if (!$scope.panel.editForm) return false;

        return Object.keys($scope.panel.editForm.$error).findIndex(function (errorKey) {
            var errorArray = $scope.panel.editForm.$error[errorKey];

            return errorArray.findIndex(function (error) { return error.$name.indexOf(tabInputPrefix) == 0; }) != -1;
        }) != -1;
    }

    function addNewRelative() {
        const relationships = angular.copy($scope.editObject);

        const newRelative = new EntityRelationship({
            id: SanteDB.application.newGuid(),
            targetModel: new Person({
                id: SanteDB.application.newGuid(),
                dateOfBirthPrecision: 3
            })
        });

        relationships.push(newRelative);

        delete ($scope.editObject); // Delete the current edit object
        $scope.editObject = relationships;

        $scope.requiresRelationship = false;
    }

    function revertRemoveRelative(relationship) {
        $scope.requiresRelationship = false;
        relationship.operation = 'Update';
    }

    function removeRelative(relationship) {
        if (canRelationshipBeRemoved()) {
            if (relationship.$id) {
                relationship.operation = 'Delete';
            } else {
                const relationships = angular.copy($scope.editObject).filter((rel) => {
                    return rel.id != relationship.id;
                });

                delete ($scope.editObject); // Delete the current edit object
                $scope.editObject = relationships;
            }
        }
    }

    function canRelationshipBeRemoved() {
        if (dateToAge($scope.scopedObject.dateOfBirth) < 16) {
            const activeRelationships = $scope.editObject.filter((rel) => {
                return rel.operation != 'Delete' || !rel.$id
            });

            $scope.requiresRelationship = activeRelationships.length == 1;

            return activeRelationships.length > 1;
        }

        return true;
    }

    function getTabPaneId(relationship, index) {
        if (relationship.relationshipTypeModel) {
            return relationship.relationshipTypeModel.mnemonic + index + 'relative'
        } else {
            return 'new-relative-' + index
        }
    }

    // Update the specified objects
    $scope.update = async function (form) {
        if (!form.$valid) return;

        try {
            // Now we want to update our patient object
            var patient = $scope.scopedObject;
            var relationships = angular.copy($scope.editObject) || [];

            if ($scope.newRelationship._active)
                relationships.push(angular.copy($scope.newRelationship));

            relationships = relationships.filter(o => !o._inverse);
            var submissionBundle = new Bundle({ resource: [patient] });

            if (!patient.relationship)
                patient.relationship = {};

            // Process relationships
            relationships.forEach(async function (rel) {
                if (!rel.relationshipTypeModel) {
                    await SanteDB.resources.concept.findAsync({ id: rel.relationshipType }).then((bundle) => {
                        if (bundle.resource && bundle.resource.length > 0) {
                            rel.relationshipTypeModel = bundle.resource[0];
                        }
                    });
                }

                var existing = patient.relationship[rel.relationshipTypeModel.mnemonic];
                if (existing && !Array.isArray(existing))
                    existing = [existing];

                // Is the relationship active or scheduled for deletion?
                if (!rel._active) {
                    // Find this relationship and remove it
                    var others = existing.filter(o => o.id != rel.id);
                    if (others.length > 0) // more left
                        patient.relationship[rel.relationshipTypeModel.mnemonic] = others;
                    else  // none left, remove relationship
                        delete (patient.relationship[rel.relationshipTypeModel.mnemonic]);
                }
                else {
                    if (!existing) // new relationship type
                        existing = patient.relationship[rel.relationshipTypeModel.mnemonic] = [];

                    var instance = existing.filter(o => o.id == rel.id);
                    if (instance.length == 0) // none currently
                        existing.push(rel);
                    else {
                        var others = existing.filter(o => o.id != rel.id);
                        others.push(rel);
                        patient.relationship[rel.relationshipTypeModel.mnemonic] = others;
                    }

                    // Erase target model and replace with identifier
                    rel.target = rel.targetModel.id;
                    submissionBundle.resource.push(rel.targetModel);
                    rel.holder = patient.id;
                    delete (rel.targetModel);
                }
            });

            await Promise.all(submissionBundle.resource.map(o => prepareEntityForSubmission(o))); // Correct entity information

            await SanteDB.resources.bundle.insertAsync(submissionBundle);

            var pscope = $scope;
            while (pscope.$parent.scopedObject)
                pscope = pscope.$parent;
            var updatedPatient = await SanteDB.resources.patient.getAsync($scope.scopedObject.id, "full"); // re-fetch the patient

            $timeout(() => {
                pscope.scopedObject = updatedPatient;
                pscope.editObject = angular.copy(pscope.scopedObject);
                toastr.success(SanteDB.locale.getString("ui.model.patient.saveSuccess"));
                form.$valid = true;
            });
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    $scope.$watch("panel.view", async function (n, o) {
        if (n == 'Edit') {
            if ($scope.editObject) {
                $scope.editObject.multipleBirthIndicator = !!$scope.editObject.multipleBirthOrder;

                if ($scope.editObject.extension) {
                    $scope.isBirthValidated = !!$scope.editObject.extension['http://santedb.org/extensions/core/birthValidated']?.[0];
                }

                $scope.editObject.age = dateToAge($scope.editObject.dateOfBirth)
            }
        }
    });

    // Scoped object
    $scope.$watch("scopedObject", async function (n, o) {
        if (n) {
            try {
                if (n.relationship) {
                    var rels = (await SanteDB.resources.concept.findAsync({ "conceptSet.mnemonic": "FamilyMember", "mnemonic": Object.keys(n.relationship) }));

                    if (!rels.resource) {
                        rels.resource = [];
                    }

                    $scope.familyMemberRelationships = rels.resource.map(o => o.mnemonic);

                    if (n.id) { // existing patient => we are in edit mode
                        $scope.relationships = Object.keys(n.relationship).filter((o) => {
                            return $scope.familyMemberRelationships.indexOf(o) > -1;
                        }).map((o) => {
                            const model = n.relationship[o];

                            const targetModel = model[0].targetModel;
                            targetModel.age = dateToAge(targetModel.dateOfBirth);

                            // Retrieve relatives telecom useModel
                            if (targetModel.telecom) {
                                for (const key of Object.keys(targetModel.telecom)) {
                                    const _telecom = targetModel.telecom[key];

                                    if ((!_telecom.useModel || !_telecom.useModel.id) && key != "$other") {
                                        SanteDB.resources.concept.findAsync({ mnemonic: key }).then((bundle) => {
                                            if (bundle.resource && bundle.resource.length > 0) {
                                                _telecom.forEach(n => n.useModel = bundle.resource[0]);
                                            }
                                        });
                                    }
                                }
                            }

                            if (targetModel.genderConcept && !targetModel.genderConceptModel) {
                                SanteDB.resources.concept.findAsync({ id: targetModel.genderConcept }).then((bundle) => {
                                    if (bundle.resource && bundle.resource.length > 0) {
                                        targetModel.genderConceptModel = bundle.resource[0];
                                    }
                                });
                            }

                            return model;
                        }).flat();

                        // Find the reverse relationships
                        var filter = {
                            "target": n.id,
                            "relationshipType.conceptSet.mnemonic": "FamilyMember"
                        };
                        var reverseRelationships = await SanteDB.resources.entityRelationship.findAsync(filter, "reverseRelationship");

                        if (reverseRelationships.resource) {
                            for (var i in reverseRelationships.resource) {
                                try {
                                    var rel = reverseRelationships.resource[i];
                                    rel._inverse = true;

                                    if (!rel.holderModel) {
                                        rel.targetModel = await SanteDB.resources.entity.getAsync(rel.holder, "full");
                                    }

                                    $scope.relationships.push(rel);
                                }
                                catch (e) {
                                    console.warn("Ignoring relationship");
                                }
                            }
                        }
                    }
                    else  // new patient => registration mode
                        $scope.relationships = Object.keys(n.relationship).filter(o => $scope.familyMemberRelationships.indexOf(o) > -1).map(o => n.relationship[o]).flat();

                    var promises = $scope.relationships.map(async function (rel) {
                        if (rel.id)
                            rel._active = true;
                        else
                            rel.id = SanteDB.application.newGuid();

                        if (rel.source && rel.source != n.id || rel.holder && !rel.holder == n.id) {
                            if (n._upstream)
                                rel.sourceModel = await SanteDB.resources.entity.getAsync({ id: rel.source || rel.holder, _upstream: true }, "full");
                            else {
                                rel.sourceModel = await SanteDB.resources.entity.getAsync(rel.source || rel.holder, "full");
                            }

                            rel.inverse = true;
                        }
                        else if ((!rel.targetModel || rel.targetModel.$type == 'Entity') && rel.target) {
                            try {
                                rel.targetModel = await SanteDB.resources.patient.getAsync({ id: rel.target, _upstream: n._upstream }, "full");
                            }
                            catch (e) {
                                rel.targetModel = await SanteDB.resources.person.getAsync({ id: rel.target, _upstream: n._upstream }, "full");
                            }

                            rel.targetModel.relationship = rel.targetModel.relationship || {};
                        }

                        if (!rel.relationshipTypeModel)
                            rel.relationshipTypeModel = await SanteDB.resources.concept.getAsync(rel.relationshipType);

                        if (rel.relationshipType == '40d18ecc-8ff8-4e03-8e58-97a980f04060' ||
                            rel.relationshipType == '29ff64e5-b564-411a-92c7-6818c02a9e48') {
                            $scope.excludeRelationshipTypes.push(rel.relationshipType);
                        }
                    });

                    await Promise.all(promises);

                    delete ($scope.editObject); // Delete the current edit object
                    $scope.editObject = angular.copy($scope.relationships);
                }

                $scope.newRelationship = new EntityRelationship({
                    id: SanteDB.application.newGuid(),
                    targetModel: new Person({
                        id: SanteDB.application.newGuid()
                    })
                });

                $scope.$apply();
            }
            catch (e) {
                console.error(`Cannot load family members: ${e}`)
            }
        }
    });
}]);
