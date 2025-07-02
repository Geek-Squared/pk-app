import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { UPost } from 'src/app/models/post.interface';
import { WorkbookService } from 'src/app/services/workbook.service';

@Component({
  selector: 'app-post-details',
  templateUrl: './post-details.component.html',
  styleUrls: ['./post-details.component.scss'],
})
export class PostDetailsComponent implements OnInit {
  @Input() story: UPost;
  public workBook = [];

  constructor(
    public modalController: ModalController,
    private workbookService: WorkbookService
  ) {}

  ngOnInit() {
    this.workbookService.getUserWorkbook().subscribe((data) => {
      this.workBook = data;
    });
  }

  dismiss(value?) {
    this.modalController.dismiss({
      dismissed: true,
      data: value,
    });
  }

  checkProgress() {
    return this.workBook[0]?.responses.find(
      (element) => element?.postId === this.story?.id
    );
  }
}
