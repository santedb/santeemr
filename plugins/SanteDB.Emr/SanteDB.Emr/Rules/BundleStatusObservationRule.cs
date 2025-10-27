using SanteDB;
using SanteDB.Core.Diagnostics;
using SanteDB.Core.Interop;
using SanteDB.Core.Model.Acts;
using SanteDB.Core.Model.Collection;
using SanteDB.Core.Model.Constants;
using SanteDB.Core.Model.DataTypes;
using SanteDB.Core.Model.Roles;
using SanteDB.Core.Security;
using SanteDB.Core.Services;
using SanteDB.Core.Templates;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace SanteEMR.Rules
{
    /// <summary>
    /// Bundle status observation rule
    /// </summary>
    internal sealed class BundleStatusObservationRule : BaseBusinessRulesService<Bundle>
    {
        /// <summary>
        /// Concept repository
        /// </summary>
        private readonly IConceptRepositoryService m_conceptRepository;
        /// <summary>
        /// Persistence service
        /// </summary>
        private readonly IDataPersistenceService<Act> m_persistenceService;
        private readonly IDataTemplateManagementService m_templateManager;
        private readonly IRepositoryService<CodedObservation> m_conditionRepository;

        /// <summary>
        /// DI constructor
        /// </summary>
        public BundleStatusObservationRule(IConceptRepositoryService conceptRepository, IDataTemplateManagementService templateManager, IDataPersistenceService<Act> persistenceService, IRepositoryService<CodedObservation> codedObservationRepository)
        {
            this.m_conceptRepository = conceptRepository;
            this.m_persistenceService = persistenceService;
            this.m_templateManager = templateManager;
            this.m_conditionRepository = codedObservationRepository;
        }


        /// <summary>
        /// Intercept the act and ensure that we want to modify the current status
        /// </summary>
        public override Bundle BeforeInsert(Bundle data)
        {
            if (data == null)
            {
                throw new ArgumentNullException(nameof(data));
            }


            // Process each act in the bundle 
            foreach (var act in data.Item.OfType<Act>().Where(o =>
                o.BatchOperation != SanteDB.Core.Model.DataTypes.BatchOperationType.Ignore &&
                o.BatchOperation != SanteDB.Core.Model.DataTypes.BatchOperationType.Delete &&
                o.TypeConceptKey != null &&
                o.StatusConceptKey == StatusKeys.Completed &&
                o.MoodConceptKey == ActMoodKeys.Eventoccurrence &&
                o.Tags?.Any(t => t.TagKey == EmrConstants.IgnoreEmrTriggersTagName && Boolean.Parse(t.Value)) != true
                ).ToArray()
            )
            {

                act.AddTag(EmrConstants.IgnoreEmrTriggersTagName, "true");
                var rct = act.LoadProperty(o => o.Participations).FirstOrDefault(o => o.ParticipationRoleKey == ActParticipationKeys.RecordTarget);
                // Determine if the patient already has this observation type which indicates a status - then update the status observation
                if (act.BatchOperation != BatchOperationType.Update && this.m_conceptRepository.IsMember(EmrConstants.PatientStatusObservation, act.TypeConceptKey.Value))
                {
                    if (rct?.PlayerEntityKey != null)
                    {
                        // determine if the patient already has an active observation for this status
                        var existing = this.m_persistenceService.Query(o => o.MoodConceptKey == ActMoodKeys.Eventoccurrence && o.StatusConceptKey != StatusKeys.Obsolete && o.TypeConceptKey == act.TypeConceptKey.Value && o.Participations.Where(p => p.ParticipationRoleKey == ActParticipationKeys.RecordTarget).Any(p => p.PlayerEntityKey == rct.PlayerEntityKey) && o.ObsoletionTime == null, AuthenticationContext.SystemPrincipal).FirstOrDefault();
                        if (existing != null && existing.Key != act.Key)
                        {
                            existing.BatchOperation = BatchOperationType.Update;
                            existing.StatusConceptKey = StatusKeys.Obsolete; // The old observation is now obsolete
                            act.LoadProperty(o => o.Relationships).Add(new ActRelationship(ActRelationshipTypeKeys.Replaces, existing.Key)); // indicate the replacement
                            data.Add(existing);
                        }
                    }
                }

                // Patient Death Observations
                if (act is DateObservation dto && act.TypeConceptKey == EmrConstants.DateOfDeathConceptKey && act.StatusConceptKey == StatusKeys.Completed) // Set date of death
                {
                    this.AddDeathRecords(data, rct, dto.Value.Value);
                }
                else if (act is CodedObservation cdoState && act.StatusConceptKey == StatusKeys.Completed && act.TypeConceptKey == ObservationTypeKeys.ClinicalState && cdoState.ValueKey == DischargeDispositionKeys.Died)
                {
                    this.AddDeathRecords(data, rct, DateTime.MinValue);
                }
                else if (act is PatientEncounter pe && pe.DischargeDispositionKey == DischargeDispositionKeys.Died && pe.StatusConceptKey == StatusKeys.Completed)
                {
                    this.AddDeathRecords(data, rct, DateTime.MinValue);
                }


                // If there is a subject act which is a coded observation
                // then this section will determine whether the condition 
                // observation need resolution or reactivation
                var subjectAct = act.LoadProperty(o => o.Relationships, referenceData: data.Item).FirstOrDefault(o => o.RelationshipTypeKey == ActRelationshipTypeKeys.HasSubject)?.TargetAct ?? act;
                if (subjectAct is CodedObservation cdo && this.m_conceptRepository.IsMember(EmrConstants.EmrConditionTrigger, subjectAct.TypeConceptKey.Value) &&
                    !subjectAct.IsNegated) // The type is not a condition and is a coded observation
                {
                    var activeCondition = this.m_conditionRepository.Find(o => o.Participations.Where(p => p.ParticipationRoleKey == ActParticipationKeys.RecordTarget).Any(p => p.PlayerEntityKey == rct.PlayerEntityKey) && o.TypeConceptKey == ObservationTypeKeys.Condition && o.ValueKey == cdo.TypeConceptKey && o.ObsoletionTime == null && o.StatusConceptKey == StatusKeys.Active).FirstOrDefault();
                    if (cdo.ValueKey.HasValue && !this.m_conceptRepository.IsMember(EmrConstants.PatientIndicatorNegatedObservation, cdo.ValueKey.Value)
                        && !StatusKeys.InactiveStates.Contains(cdo.StatusConceptKey.Value))
                    {
                        activeCondition = activeCondition ?? new CodedObservation()
                        {
                            MoodConceptKey = ActMoodKeys.Eventoccurrence,
                            CreatedByKey = Guid.Parse(AuthenticationContext.SystemUserSid),
                            StartTime = act.ActTime,
                            Policies = act.Policies,
                            TypeConceptKey = ObservationTypeKeys.Condition,
                            ValueKey = cdo.TypeConceptKey,
                            StatusConceptKey = StatusKeys.Active,
                            Participations = new List<ActParticipation>()
                            {
                                new ActParticipation(ActParticipationKeys.RecordTarget, rct.PlayerEntityKey)
                            }
                        };
                        activeCondition.BatchOperation = BatchOperationType.InsertOrUpdate;
                        activeCondition.StatusConceptKey = StatusKeys.Active;
                    }
                    else if (activeCondition != null)
                    {
                        // We want to invalidate the active condition
                        activeCondition.StatusConceptKey = StatusKeys.Completed;
                        activeCondition.StopTime = act.ActTime;
                        activeCondition.BatchOperation = BatchOperationType.Update;
                    }

                    if (activeCondition != null)
                    {
                        activeCondition.LoadProperty(o => o.Relationships).Clear();
                        activeCondition.Relationships.Add(new ActRelationship(ActRelationshipTypeKeys.RefersTo, act.Key));
                        data.Add(activeCondition);
                    }

                }

            }
            return base.BeforeInsert(data);
        }

        /// <summary>
        /// Add death record to the patient
        /// </summary>
        private void AddDeathRecords(Bundle bundleToAdd, ActParticipation recordTarget, DateTime dateOfDeath)
        {
            var player = recordTarget.LoadProperty(o => o.PlayerEntity, referenceData: bundleToAdd.Item) as Patient;
            if (player == null || player.DeceasedDate.HasValue == true && player.DeceasedDate > dateOfDeath) // updated information 
            {
                return;
            }

            // If the player is indicated as dead we don't update them 
            // Is there a clinical status observation indicating the patient is dead?
            if (!bundleToAdd.Item.OfType<CodedObservation>().Any(a => a.TypeConceptKey == ObservationTypeKeys.ClinicalState &&
                a.ValueKey == DischargeDispositionKeys.Died))
            {
                bundleToAdd.Add(new CodedObservation()
                {
                    TypeConceptKey = ObservationTypeKeys.ClinicalState,
                    ValueKey = DischargeDispositionKeys.Died,
                    ActTime = DateTimeOffset.Now,
                    MoodConceptKey = ActMoodKeys.Eventoccurrence,
                    StatusConceptKey = StatusKeys.Completed,
                    Participations = new List<ActParticipation>()
                    {
                        new ActParticipation(ActParticipationKeys.RecordTarget, recordTarget.PlayerEntityKey)
                    }
                });
            }

            // Is the record target's patient dead?
            if (player?.DeceasedDate.HasValue != true || player.DeceasedDate < dateOfDeath)
            {
                player.DeceasedDate = dateOfDeath;
                player.DeceasedDatePrecision = DatePrecision.Day;
                player.BatchOperation = BatchOperationType.Update;
                if (!bundleToAdd.Item.Any(o => o.Key == player.Key))
                {
                    bundleToAdd.Add(player);
                }
            }

        }
    }
}
