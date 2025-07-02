// src/app/pages/interventions/interventions.page.ts

import { Component, OnInit } from '@angular/core';
import { InterventionsService } from 'src/app/services/interventions.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Intervention } from 'src/app/models/intervention.interface';

@Component({
  selector: 'app-interventions',
  templateUrl: './interventions.page.html',
  styleUrls: ['./interventions.page.scss'],
})
export class InterventionsPage implements OnInit {
  interventions$: Observable<Intervention[]> | undefined;

  constructor(private interventionsService: InterventionsService) {}

  ngOnInit(): void {
    this.interventions$ = this.interventionsService.getInterventions().pipe(
      map((docs) =>
        docs.map((doc: any) => {
          const data = doc.payload.doc.data();
          const id = doc.payload.doc.id;
          return { id, ...data };
        })
      )
    );
  }
}
