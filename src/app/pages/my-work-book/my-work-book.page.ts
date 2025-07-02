import { Component, OnInit } from '@angular/core';
import { WorkbookService } from 'src/app/services/workbook.service';

@Component({
  selector: 'app-my-work-book',
  templateUrl: './my-work-book.page.html',
  styleUrls: ['./my-work-book.page.scss'],
  standalone: false
})
export class MyWorkBookPage implements OnInit {
  public workbook = [];
  public posts;

  constructor(private workbookService: WorkbookService) {}

  ngOnInit() {
    this.workbookService.getUserQuestionResponses().subscribe((res: any) => {
      this.workbook = res[0]?.responses;
    });
  }
}
